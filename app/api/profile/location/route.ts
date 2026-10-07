import { NextResponse } from 'next/server';
import { getVerifiedUser } from '@/lib/supabase-route';
import { rateLimit, rateLimitAll, tooManyRequests } from '@/lib/rate-limit';

/**
 * Sets the signed-in user's profiles.location from their own PIN code.
 *
 * The client never sends coordinates: the server reads the caller's present_zip
 * (or city), geocodes it with Nominatim and stores the area centroid rounded to
 * 3 dp (~100 m; a PIN area, not a home address). Other users only ever see it
 * through approx_location(), which rounds to 2 dp.
 *
 * Nominatim policy: at most 1 request/second for the whole app and an
 * identifying User-Agent. A global 1-per-second limiter plus per-user limits
 * keep us inside it; results are cached by Next for 30 days per query.
 */

const USER_AGENT = 'Vital/1.0 (https://vitalapp.in; sachin@vitalapp.in)';
const NOMINATIM = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=in';
const MAX_CITY = 100;

// India's bounding box (generous); anything outside is a bad match.
const IN_LAT: [number, number] = [6, 37.5];
const IN_LNG: [number, number] = [68, 97.5];

type Coords = { latitude: number; longitude: number };

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const round3 = (n: number) => Math.round(n * 1000) / 1000;

function insideIndia(lat: number, lng: number) {
    return Number.isFinite(lat) && Number.isFinite(lng)
        && lat >= IN_LAT[0] && lat <= IN_LAT[1] && lng >= IN_LNG[0] && lng <= IN_LNG[1];
}

class UpstreamError extends Error {}

/** Waits for the app-wide Nominatim slot (1 request/second). */
async function nominatimSlot(): Promise<boolean> {
    for (let attempt = 0; attempt < 4; attempt++) {
        if (await rateLimit('nominatim:global', 1, 1)) return true;
        await sleep(1100);
    }
    return false;
}

/** One Nominatim lookup. Returns null when nothing usable was found; throws UpstreamError on outages. */
async function lookup(params: string): Promise<Coords | null> {
    if (!(await nominatimSlot())) throw new UpstreamError('geocoder busy');
    let response: Response;
    try {
        response = await fetch(`${NOMINATIM}&${params}`, {
            headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en' },
            signal: AbortSignal.timeout(8000),
            next: { revalidate: 60 * 60 * 24 * 30 },
        });
    } catch {
        throw new UpstreamError('geocoder unreachable');
    }
    if (!response.ok) throw new UpstreamError(`geocoder status ${response.status}`);
    const data: unknown = await response.json().catch(() => null);
    if (!Array.isArray(data) || data.length === 0) return null;
    const lat = Number(data[0]?.lat);
    const lng = Number(data[0]?.lon);
    if (!insideIndia(lat, lng)) return null;
    return { latitude: round3(lat), longitude: round3(lng) };
}

export async function POST(request: Request) {
    const { supabase, user } = await getVerifiedUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const allowed = await rateLimitAll([
        [`profile-location:min:${user.id}`, 60, 3],
        [`profile-location:day:${user.id}`, 60 * 60 * 24, 20],
    ]);
    if (!allowed) return tooManyRequests(60);

    // RLS: the user's own client can only read and update their own row.
    const { data: profile, error: readError } = await supabase
        .from('profiles')
        .select('present_zip, city')
        .eq('id', user.id)
        .maybeSingle();
    if (readError || !profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    const zip = typeof profile.present_zip === 'string' ? profile.present_zip.replace(/\s/g, '') : '';
    const validZip = /^[1-9][0-9]{5}$/.test(zip);
    const city = typeof profile.city === 'string' ? profile.city.trim().slice(0, MAX_CITY) : '';

    // Most precise first: the PIN as a postal code, the PIN as free text, then the city.
    const attempts: Array<[params: string, source: 'pin' | 'city']> = [];
    if (validZip) {
        attempts.push([`postalcode=${zip}`, 'pin']);
        attempts.push([`q=${encodeURIComponent(`${zip} India`)}`, 'pin']);
    }
    if (city) attempts.push([`city=${encodeURIComponent(city)}`, 'city']);
    if (attempts.length === 0) return NextResponse.json({ updated: false, reason: 'no_pin' });

    let found: (Coords & { source: 'pin' | 'city' }) | null = null;
    try {
        for (const [params, source] of attempts) {
            const coords = await lookup(params);
            if (coords) { found = { ...coords, source }; break; }
        }
    } catch (error) {
        // Outage: keep whatever is stored; ranking by PIN area still works.
        console.error('profile location geocoding failed:', error instanceof Error ? error.message : error);
        return NextResponse.json({ error: 'Location service unavailable' }, { status: 502 });
    }

    // Not found: clear any stale coordinates (e.g. from a previous PIN code).
    const location = found
        ? { latitude: found.latitude, longitude: found.longitude, source: found.source, geocoded_at: new Date().toISOString() }
        : null;

    const { data: updated, error: writeError } = await supabase
        .from('profiles')
        .update({ location })
        .eq('id', user.id)
        .select('id');
    if (writeError || !updated || updated.length !== 1) {
        console.error('profile location update failed:', writeError?.code ?? 'no row updated');
        return NextResponse.json({ error: 'Could not save location' }, { status: 500 });
    }

    return NextResponse.json({ updated: true, located: Boolean(found), source: found?.source ?? null });
}
