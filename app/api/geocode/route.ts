import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const zip = searchParams.get('zip');
    const city = searchParams.get('city');
    const query = searchParams.get('q');

    // Construct Nominatim URL
    let nominatimUrl = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&country=India';

    if (zip) {
        nominatimUrl += `&postalcode=${zip}`;
    } else if (city) {
        nominatimUrl += `&city=${city}`;
    } else if (query) {
        nominatimUrl += `&q=${encodeURIComponent(query)}`;
    } else {
        return NextResponse.json({ error: 'Missing search parameters' }, { status: 400 });
    }

    try {
        const response = await fetch(nominatimUrl, {
            headers: {
                'User-Agent': 'VitalApp/1.0 (vitalapp.in)', // Required by Nominatim policy
                'Accept-Language': 'en-US,en;q=0.9',
            },
        });

        if (!response.ok) {
            throw new Error(`Nominatim API error: ${response.statusText}`);
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Geocoding error:', error);
        return NextResponse.json({ error: 'Failed to fetch location data' }, { status: 500 });
    }
}
