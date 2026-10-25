import { rateLimit } from '@/lib/rate-limit';
import { insideIndia } from '@/lib/location';
import { UpstreamError, type Place } from '@/lib/nominatim';

/**
 * Server-only: place suggestions while someone types (the hospital field on
 * the request form), from Photon (photon.komoot.io, OSM data, keyless).
 *
 * Photon is built for search-as-you-type; Nominatim's public server forbids
 * it, so Nominatim stays for explicit searches only (lib/nominatim.ts).
 * To stay a fair user of the free service: the browser waits ~400 ms after the
 * last keystroke and needs 3+ characters, answers are cached in memory per
 * server instance (and by the browser for an hour), and calls that miss the
 * cache share an app-wide cap.
 */

const USER_AGENT = 'Vital/1.0 (https://vitalapp.in; sachin@vitalapp.in)';
const PHOTON = 'https://photon.komoot.io/api/';
// India's bounding box, as in lib/location.ts: minLon,minLat,maxLon,maxLat.
const INDIA_BBOX = '68,6,97.5,37.5';
const TIMEOUT_MS = 4000;
/** Photon calls per minute for the whole app (cache misses only). */
const GLOBAL_PER_MINUTE = 120;

const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE = 2000;
const cache = new Map<string, { at: number; places: Place[] }>();

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const PIN = /^[1-9][0-9]{5}$/;

type Feature = { geometry?: { coordinates?: unknown }; properties?: Record<string, unknown> };

function toPlace(f: Feature): Place | null {
    const [longitude, latitude] = Array.isArray(f?.geometry?.coordinates) ? f.geometry.coordinates.map(Number) : [];
    const p = f?.properties ?? {};
    if (str(p.countrycode)?.toUpperCase() !== 'IN' || !insideIndia(latitude, longitude)) return null;
    const name = str(p.name);
    const city = str(p.city) ?? str(p.county);
    const locality = str(p.locality) ?? str(p.district);
    const postcode = (str(p.postcode) ?? '').replace(/\s/g, '');
    const unique = (parts: Array<string | null>) =>
        parts.filter((v, i, all): v is string => !!v && all.findIndex(o => o?.toLowerCase() === v.toLowerCase()) === i);
    const label = unique([name, locality, city]).join(', ');
    const displayName = unique([name, str(p.street), locality, city, str(p.state), PIN.test(postcode) ? postcode : null]).join(', ');
    if (!label) return null;
    return {
        latitude,
        longitude,
        name,
        label: label.slice(0, 120),
        displayName: displayName.slice(0, 300),
        city,
        district: str(p.county) ?? str(p.district),
        state: str(p.state),
        zipcode: PIN.test(postcode) ? postcode : null,
    };
}

/**
 * Up to 5 places in India matching `query` (3–100 characters, trimmed by the
 * caller), nearest to `near` first when given. Throws UpstreamError when
 * Photon fails or the app-wide cap is reached.
 */
export async function suggestPlaces(query: string, near?: { latitude: number; longitude: number } | null): Promise<Place[]> {
    // ~10 km grid for the bias, so nearby taps share cache entries (and Photon never sees an exact spot).
    const bias = near && insideIndia(near.latitude, near.longitude)
        ? { lat: near.latitude.toFixed(1), lon: near.longitude.toFixed(1) }
        : null;
    const key = `${query.toLowerCase().replace(/\s+/g, ' ')}|${bias ? `${bias.lat},${bias.lon}` : ''}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at <= TTL_MS) return hit.places;
    if (hit) cache.delete(key);

    if (!(await rateLimit('photon:global', 60, GLOBAL_PER_MINUTE))) throw new UpstreamError('suggestions busy', 'busy');

    // Ask for more than we show: the bounding box also covers neighbouring countries.
    const params = new URLSearchParams({ q: query, limit: '10', lang: 'en', bbox: INDIA_BBOX });
    if (bias) { params.set('lat', bias.lat); params.set('lon', bias.lon); }
    let response: Response;
    try {
        response = await fetch(`${PHOTON}?${params}`, {
            headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
            signal: AbortSignal.timeout(TIMEOUT_MS),
            cache: 'no-store',
        });
    } catch (error) {
        const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
        throw new UpstreamError(timedOut ? 'photon timeout' : 'photon unreachable', timedOut ? 'timeout' : 'unreachable');
    }
    if (!response.ok) {
        const refused = response.status === 403 || response.status === 429;
        throw new UpstreamError(`photon status ${response.status}`, refused ? 'refused' : 'status');
    }
    const data = await response.json().catch(() => null) as { features?: Feature[] } | null;
    const features = Array.isArray(data?.features) ? data.features : [];

    // OSM often maps one hospital several times (building, campus, entrance): show it once.
    const places: Place[] = [];
    for (const place of features.map(toPlace)) {
        if (!place) continue;
        const same = places.some(o => o.label.toLowerCase() === place.label.toLowerCase()
            && Math.abs(o.latitude - place.latitude) < 0.01 && Math.abs(o.longitude - place.longitude) < 0.01);
        if (!same) places.push(place);
        if (places.length === 5) break;
    }

    if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value!);
    cache.set(key, { at: Date.now(), places });
    return places;
}
