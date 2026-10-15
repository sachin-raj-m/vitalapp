import { NextResponse } from 'next/server';
import { getVerifiedUser } from '@/lib/supabase-route';
import { rateLimitAll, tooManyRequests } from '@/lib/rate-limit';
import { searchPlaces, reversePlace, UpstreamError, type Place } from '@/lib/nominatim';
import { distanceKm, insideIndia, usableLocation, isPrecise, MAX_GPS_ACCURACY_M } from '@/lib/location';

/**
 * Sets the signed-in user's profiles.location.
 *
 * Body (JSON, optional):
 *   {}                                   PIN code fallback (default): geocode the
 *   { mode: 'pin', replace?: boolean }   caller's present_zip (or city) to the area
 *                                        centre. A point the donor set precisely is
 *                                        kept if it is within 15 km of the new PIN
 *                                        area, unless replace is true.
 *   { mode: 'point', source: 'gps' | 'manual', latitude, longitude, accuracy? }
 *                                        a point from the device or placed on a map.
 *                                        Must be inside India; device fixes rougher
 *                                        than 5 km are refused.
 *
 * The point is stored for the owner and the server only (RLS); everyone else
 * sees it through approx_location(), rounded to ~1 km. The database
 * (normalize_profile_location) validates and rounds it again.
 */

const MAX_CITY = 100;
const KEEP_PRECISE_WITHIN_KM = 15;

type Body =
    | { mode?: 'pin'; replace?: boolean }
    | { mode: 'point'; source: 'gps' | 'manual'; latitude: number; longitude: number; accuracy?: number };

function parseBody(raw: unknown): Body | { error: string } {
    if (raw === null || raw === undefined) return {};
    if (typeof raw !== 'object' || Array.isArray(raw)) return { error: 'Invalid request' };
    const b = raw as Record<string, unknown>;
    if (b.mode === undefined || b.mode === 'pin') return { mode: 'pin', replace: b.replace === true };
    if (b.mode !== 'point') return { error: 'Invalid request' };
    if (b.source !== 'gps' && b.source !== 'manual') return { error: 'Invalid location source' };
    const latitude = typeof b.latitude === 'number' ? b.latitude : NaN;
    const longitude = typeof b.longitude === 'number' ? b.longitude : NaN;
    if (!insideIndia(latitude, longitude)) {
        return { error: 'That point isn’t in India. Vital can only alert donors in India.' };
    }
    let accuracy: number | undefined;
    if (b.accuracy !== undefined && b.accuracy !== null) {
        if (typeof b.accuracy !== 'number' || !Number.isFinite(b.accuracy) || b.accuracy < 0) return { error: 'Invalid accuracy' };
        accuracy = b.accuracy;
    }
    if (b.source === 'gps' && accuracy === undefined) return { error: 'Missing accuracy' };
    return { mode: 'point', source: b.source, latitude, longitude, accuracy };
}

const nowIso = () => new Date().toISOString();

export async function POST(request: Request) {
    const { supabase, user } = await getVerifiedUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const text = await request.text().catch(() => '');
    let raw: unknown = null;
    if (text.trim()) {
        if (text.length > 2000) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
        try { raw = JSON.parse(text); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }
    }
    const body = parseBody(raw);
    if ('error' in body) return NextResponse.json({ error: body.error }, { status: 400 });

    const allowed = await rateLimitAll([
        [`profile-location:min:${user.id}`, 60, 4],
        [`profile-location:day:${user.id}`, 60 * 60 * 24, 20],
    ]);
    if (!allowed) return tooManyRequests(60);

    // RLS: the user's own client can only read and update their own row.
    const { data: profile, error: readError } = await supabase
        .from('profiles')
        .select('present_zip, city, location')
        .eq('id', user.id)
        .maybeSingle();
    if (readError || !profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    let location: Record<string, unknown> | null;
    let kept = false;

    try {
        if (body.mode === 'point') {
            if (body.source === 'gps' && (body.accuracy ?? Infinity) > MAX_GPS_ACCURACY_M) {
                return NextResponse.json({
                    error: 'Your device only knows roughly where you are. Place yourself on the map instead, or use your PIN code.',
                    reason: 'imprecise',
                }, { status: 422 });
            }
            // The locality is a convenience for the donor; never fail the save over it.
            let place: Place | null = null;
            try { place = await reversePlace(body.latitude, body.longitude); } catch { /* best effort */ }
            location = {
                latitude: body.latitude,
                longitude: body.longitude,
                source: body.source,
                accuracy_m: body.source === 'gps' ? Math.max(1, Math.round(body.accuracy!)) : Math.min(Math.max(Math.round(body.accuracy ?? 100), 10), 5000),
                ...(place?.label ? { label: place.label } : {}),
                updated_at: nowIso(),
            };
        } else {
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

            let found: (Place & { source: 'pin' | 'city' }) | null = null;
            for (const [params, source] of attempts) {
                const [hit] = await searchPlaces(params, 1);
                if (hit) { found = { ...hit, source }; break; }
            }

            const current = usableLocation(profile.location);
            if (!body.replace && isPrecise(current) && current && (!found
                || distanceKm(current.latitude, current.longitude, found.latitude, found.longitude) <= KEEP_PRECISE_WITHIN_KM)) {
                // The donor's own point still fits their PIN area: keep it.
                kept = true;
                location = null;
            } else if (found) {
                location = {
                    latitude: Math.round(found.latitude * 1000) / 1000,
                    longitude: Math.round(found.longitude * 1000) / 1000,
                    source: found.source,
                    accuracy_m: found.source === 'pin' ? 5000 : 15000,
                    label: found.source === 'pin' ? `PIN ${zip} area` : (found.city ?? found.label),
                    updated_at: nowIso(),
                };
            } else {
                // Not found: clear any stale coordinates (e.g. from a previous PIN code).
                location = null;
            }
        }
    } catch (error) {
        if (!(error instanceof UpstreamError)) throw error;
        // Outage: keep whatever is stored; ranking by PIN area still works.
        console.error('profile location geocoding failed:', error.message);
        return NextResponse.json({ error: 'The location service is unavailable right now. Please try again shortly.' }, { status: 502 });
    }

    if (kept) {
        return NextResponse.json({ updated: false, kept: true, located: true, location: usableLocation(profile.location) });
    }

    const { data: updated, error: writeError } = await supabase
        .from('profiles')
        .update({ location })
        .eq('id', user.id)
        .select('location');
    if (writeError || !updated || updated.length !== 1) {
        console.error('profile location update failed:', writeError?.code ?? 'no row updated');
        return NextResponse.json({ error: 'Could not save your location. Please try again.' }, { status: 500 });
    }

    const saved = usableLocation(updated[0].location);
    return NextResponse.json({ updated: true, located: Boolean(saved), source: saved?.source ?? null, location: saved });
}
