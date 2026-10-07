import { NextResponse } from 'next/server';
import { clientIp, rateLimitAll, tooManyRequests } from '@/lib/rate-limit';

const MAX_TEXT = 100;

/**
 * Thin proxy to Nominatim (which allows ~1 request/second for the whole app).
 * Per-IP limits stop one client from getting us blocked, and successful lookups
 * are cached at the CDN for a day.
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const zip = searchParams.get('zip');
    const city = searchParams.get('city')?.trim();
    const query = searchParams.get('q')?.trim();

    let nominatimUrl = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&country=India';

    if (zip) {
        if (!/^[0-9]{6}$/.test(zip)) {
            return NextResponse.json({ error: 'Invalid PIN code' }, { status: 400 });
        }
        nominatimUrl += `&postalcode=${zip}`;
    } else if (city) {
        if (city.length > MAX_TEXT) return NextResponse.json({ error: 'City is too long' }, { status: 400 });
        nominatimUrl += `&city=${encodeURIComponent(city)}`;
    } else if (query) {
        if (query.length > MAX_TEXT) return NextResponse.json({ error: 'Query is too long' }, { status: 400 });
        nominatimUrl += `&q=${encodeURIComponent(query)}`;
    } else {
        return NextResponse.json({ error: 'Missing search parameters' }, { status: 400 });
    }

    const ip = clientIp(request);
    const allowed = await rateLimitAll([
        [`geocode:ip:${ip}`, 60, 30],
        [`geocode:iphour:${ip}`, 60 * 60, 300],
    ]);
    if (!allowed) return tooManyRequests(60);

    try {
        const response = await fetch(nominatimUrl, {
            headers: {
                'User-Agent': 'VitalApp/1.0 (vitalapp.in)', // Required by Nominatim policy
                'Accept-Language': 'en-US,en;q=0.9',
            },
        });

        if (!response.ok) {
            throw new Error(`Nominatim API error: ${response.status}`);
        }

        const data = await response.json();
        return NextResponse.json(data, {
            headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400' },
        });
    } catch (error) {
        console.error('Geocoding error:', error);
        return NextResponse.json({ error: 'Failed to fetch location data' }, { status: 502 });
    }
}
