import { NextResponse } from 'next/server';
import { clientIp, rateLimitAll, tooManyRequests } from '@/lib/rate-limit';
import { reversePlace, searchPlaces, UpstreamError, type Place } from '@/lib/nominatim';

const MAX_TEXT = 100;
const CACHE = { 'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400' };

/**
 * Server-side geocoding (Nominatim, India only), so the browser never calls a
 * third party. Modes:
 *   ?zip=682011 | ?city=Kochi | ?q=text   first match, as [{ lat, lon, display_name }]
 *   ?search=text                          up to 5 places, as { results: Place[] }
 *                                         (hospital search on the request form)
 *   ?lat=9.98&lng=76.28                   the place at a point, as { place: Place | null }
 *
 * Per-IP limits stop one client from getting us blocked; all calls share the
 * app-wide 1-per-second Nominatim slot.
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const zip = searchParams.get('zip');
    const city = searchParams.get('city')?.trim();
    const query = searchParams.get('q')?.trim();
    const search = searchParams.get('search')?.trim();
    const latParam = searchParams.get('lat');
    const lngParam = searchParams.get('lng');

    let mode: 'first' | 'search' | 'reverse';
    let params = '';
    let lat = NaN;
    let lng = NaN;

    if (latParam !== null || lngParam !== null) {
        mode = 'reverse';
        lat = Number(latParam);
        lng = Number(lngParam);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
    } else if (search) {
        mode = 'search';
        if (search.length > MAX_TEXT) return NextResponse.json({ error: 'Search is too long' }, { status: 400 });
        if (search.length < 3) return NextResponse.json({ error: 'Search is too short' }, { status: 400 });
        params = `q=${encodeURIComponent(search)}`;
    } else if (zip) {
        mode = 'first';
        if (!/^[0-9]{6}$/.test(zip)) return NextResponse.json({ error: 'Invalid PIN code' }, { status: 400 });
        params = `postalcode=${zip}`;
    } else if (city) {
        mode = 'first';
        if (city.length > MAX_TEXT) return NextResponse.json({ error: 'City is too long' }, { status: 400 });
        params = `city=${encodeURIComponent(city)}`;
    } else if (query) {
        mode = 'first';
        if (query.length > MAX_TEXT) return NextResponse.json({ error: 'Query is too long' }, { status: 400 });
        params = `q=${encodeURIComponent(query)}`;
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
        if (mode === 'reverse') {
            const place: Place | null = await reversePlace(lat, lng);
            return NextResponse.json({ place }, { headers: CACHE });
        }
        if (mode === 'search') {
            const results = await searchPlaces(params, 5);
            return NextResponse.json({ results }, { headers: CACHE });
        }
        const [hit] = await searchPlaces(params, 1);
        const legacy = hit ? [{ lat: String(hit.latitude), lon: String(hit.longitude), display_name: hit.displayName }] : [];
        return NextResponse.json(legacy, { headers: CACHE });
    } catch (error) {
        console.error('Geocoding error:', error instanceof UpstreamError ? error.message : error);
        return NextResponse.json({ error: 'Failed to fetch location data' }, { status: 502 });
    }
}
