import { searchPlaces, UpstreamError, type UpstreamReason } from '@/lib/nominatim';
import { insideIndia } from '@/lib/location';

/**
 * Server-only: the centre of an Indian PIN code area (or of a city), robust to
 * one geocoder being slow, blocked or down.
 *
 * Order, most precise first:
 *   1. OpenStreetMap Nominatim, the PIN as a postal code.
 *   2. Photon (photon.komoot.io, OSM data, keyless), the PIN as a postcode.
 *   3. India Post's directory (api.postalpincode.in, keyless, no coordinates):
 *      the PIN's district and state, then that district's centre (Photon, then
 *      Nominatim). Also tells us when a PIN doesn't exist at all.
 * Every call has a short timeout and the whole lookup a deadline, so the
 * route answers well inside the function's time limit. Results are cached per
 * PIN in memory (per server instance), so retries and repeat PINs are free.
 */

export interface Area {
    latitude: number;
    longitude: number;
    /** 'pin': the PIN area itself; 'district': the PIN's district centre; 'city': the city centre. */
    precision: 'pin' | 'district' | 'city';
    district: string | null;
    state: string | null;
    city: string | null;
}

export type AreaLookup =
    | { status: 'found'; area: Area }
    /** No geocoder knows it (or India Post says the PIN doesn't exist). */
    | { status: 'not_found' }
    /** Every geocoder failed; `reason` is the most telling failure. */
    | { status: 'unavailable'; reason: UpstreamReason };

const USER_AGENT = 'Vital/1.0 (https://vitalapp.in; sachin@vitalapp.in)';
const PHOTON = 'https://photon.komoot.io/api/';
const INDIA_POST = 'https://api.postalpincode.in/pincode/';
// India's bounding box, as in lib/location.ts: minLon,minLat,maxLon,maxLat.
const INDIA_BBOX = '68,6,97.5,37.5';

const CALL_TIMEOUT_MS = 6000;
const DEADLINE_MS = 18000;

const FOUND_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MISSING_TTL_MS = 60 * 60 * 1000;
const MAX_CACHE = 2000;
const cache = new Map<string, { at: number; value: AreaLookup }>();

function cached(key: string): AreaLookup | null {
    const hit = cache.get(key);
    if (!hit) return null;
    const ttl = hit.value.status === 'found' ? FOUND_TTL_MS : MISSING_TTL_MS;
    if (Date.now() - hit.at > ttl) { cache.delete(key); return null; }
    return hit.value;
}

function remember(key: string, value: AreaLookup): AreaLookup {
    // Outages are never cached: the next tap should try again.
    if (value.status === 'unavailable') return value;
    if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value!);
    cache.set(key, { at: Date.now(), value });
    return value;
}

/** Tracks the time left and the worst failure seen, so the caller can say why. */
class Attempts {
    private readonly start = Date.now();
    private failure: UpstreamReason | null = null;

    timeLeft(): number { return DEADLINE_MS - (Date.now() - this.start); }

    /** Runs one geocoder call; null if it failed or there is no time left. */
    async run<T>(label: string, fn: (timeoutMs: number) => Promise<T>): Promise<T | null> {
        const left = this.timeLeft();
        if (left < 1500) return null;
        try {
            return await fn(Math.min(CALL_TIMEOUT_MS, left));
        } catch (error) {
            const reason: UpstreamReason = error instanceof UpstreamError ? error.reason : 'unreachable';
            console.error(`pin geocoding: ${label} failed:`, error instanceof Error ? error.message : error);
            // 'refused' (403/429) and 'busy' say the most about what the donor should do.
            if (!this.failure || reason === 'refused' || reason === 'busy') this.failure = reason;
            return null;
        }
    }

    get anyFailed(): boolean { return this.failure !== null; }
    get reason(): UpstreamReason { return this.failure ?? 'status'; }
}

async function getJson(url: string, timeoutMs: number): Promise<unknown> {
    let response: Response;
    try {
        response = await fetch(url, {
            headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
            signal: AbortSignal.timeout(timeoutMs),
            cache: 'no-store',
        });
    } catch (error) {
        const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
        throw new UpstreamError(`${new URL(url).host} ${timedOut ? 'timeout' : 'unreachable'}`, timedOut ? 'timeout' : 'unreachable');
    }
    if (!response.ok) {
        const refused = response.status === 403 || response.status === 429;
        throw new UpstreamError(`${new URL(url).host} status ${response.status}`, refused ? 'refused' : 'status');
    }
    const data = await response.json().catch(() => undefined);
    if (data === undefined) throw new UpstreamError(`${new URL(url).host} sent invalid JSON`, 'status');
    return data;
}

type PhotonFeature = {
    geometry?: { coordinates?: unknown };
    properties?: Record<string, unknown>;
};

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** Photon search inside India; `tag` narrows it (e.g. place:postcode). */
async function photon(query: string, timeoutMs: number, tag?: string): Promise<Array<{ latitude: number; longitude: number; props: Record<string, unknown> }>> {
    const params = new URLSearchParams({ q: query, limit: '5', lang: 'en', bbox: INDIA_BBOX });
    if (tag) params.set('osm_tag', tag);
    const data = await getJson(`${PHOTON}?${params}`, timeoutMs) as { features?: PhotonFeature[] } | null;
    const features = Array.isArray(data?.features) ? data.features : [];
    return features.flatMap(f => {
        const [lon, lat] = Array.isArray(f?.geometry?.coordinates) ? f.geometry.coordinates.map(Number) : [];
        const props = f?.properties ?? {};
        if (str(props.countrycode)?.toUpperCase() !== 'IN' || !insideIndia(lat, lon)) return [];
        return [{ latitude: lat, longitude: lon, props }];
    });
}

/** India Post's directory: the PIN's district and state, or 'none' if it doesn't exist. */
async function indiaPost(zip: string, timeoutMs: number): Promise<{ district: string; state: string } | 'none' | null> {
    const data = await getJson(`${INDIA_POST}${zip}`, timeoutMs);
    const entry = Array.isArray(data) ? data[0] as { Status?: unknown; PostOffice?: unknown } : null;
    if (!entry) return null;
    if (entry.Status === 'Error' || entry.PostOffice === null) return 'none';
    const offices = Array.isArray(entry.PostOffice) ? entry.PostOffice as Array<Record<string, unknown>> : [];
    const office = offices.find(o => str(o.District) && str(o.State));
    return office ? { district: str(office.District)!, state: str(office.State)! } : null;
}

/** The centre of PIN code `zip` (6 digits, validated by the caller). */
export async function locatePin(zip: string): Promise<AreaLookup> {
    const key = `pin:${zip}`;
    const hit = cached(key);
    if (hit) return hit;

    const tries = new Attempts();

    // 1. Nominatim, as a postal code. One slot attempt: if the app-wide 1/s
    //    slot is taken we move on to Photon rather than queue.
    const nominatim = await tries.run('nominatim postcode', timeoutMs =>
        searchPlaces(`postalcode=${zip}`, 1, { timeoutMs, slotAttempts: 2 }));
    if (nominatim?.[0]) {
        const p = nominatim[0];
        return remember(key, { status: 'found', area: { latitude: p.latitude, longitude: p.longitude, precision: 'pin', district: p.district, state: p.state, city: p.city } });
    }

    // 2. Photon, the same OSM postcode data from a different service.
    const fromPhoton = await tries.run('photon postcode', timeoutMs => photon(zip, timeoutMs, 'place:postcode'));
    const exact = fromPhoton?.find(f => str(f.props.name)?.replace(/\s/g, '') === zip || str(f.props.postcode)?.replace(/\s/g, '') === zip);
    if (exact) {
        return remember(key, { status: 'found', area: {
            latitude: exact.latitude, longitude: exact.longitude, precision: 'pin',
            district: str(exact.props.district) ?? str(exact.props.county), state: str(exact.props.state), city: str(exact.props.city),
        } });
    }

    // 3. India Post: which district is it in? Then that district's centre.
    const post = await tries.run('india post', timeoutMs => indiaPost(zip, timeoutMs));
    if (post === 'none') return remember(key, { status: 'not_found' });
    if (post) {
        const query = `${post.district}, ${post.state}, India`;
        const district = (await tries.run('photon district', timeoutMs => photon(query, timeoutMs)))?.[0]
            ?? (await tries.run('nominatim district', timeoutMs =>
                searchPlaces(`q=${encodeURIComponent(query)}`, 1, { timeoutMs, slotAttempts: 2 })))?.[0];
        if (district) {
            return remember(key, { status: 'found', area: {
                latitude: district.latitude, longitude: district.longitude, precision: 'district',
                district: post.district, state: post.state, city: null,
            } });
        }
    }

    // Nothing found. If a service failed along the way we can't be sure the PIN
    // is unknown, so report the outage (and don't cache it).
    if (tries.anyFailed) return { status: 'unavailable', reason: tries.reason };
    return remember(key, { status: 'not_found' });
}

/** The centre of a city in India (free text, trimmed by the caller). */
export async function locateCity(city: string): Promise<AreaLookup> {
    const key = `city:${city.toLowerCase()}`;
    const hit = cached(key);
    if (hit) return hit;

    const tries = new Attempts();
    const nominatim = await tries.run('nominatim city', timeoutMs =>
        searchPlaces(`city=${encodeURIComponent(city)}`, 1, { timeoutMs, slotAttempts: 2 }));
    const p = nominatim?.[0];
    if (p) return remember(key, { status: 'found', area: { latitude: p.latitude, longitude: p.longitude, precision: 'city', district: p.district, state: p.state, city: p.city ?? city } });

    const q = (await tries.run('photon city', timeoutMs => photon(`${city}, India`, timeoutMs, 'place')))?.[0];
    if (q) return remember(key, { status: 'found', area: { latitude: q.latitude, longitude: q.longitude, precision: 'city', district: str(q.props.county), state: str(q.props.state), city: str(q.props.name) ?? city } });

    if (tries.anyFailed) return { status: 'unavailable', reason: tries.reason };
    return remember(key, { status: 'not_found' });
}
