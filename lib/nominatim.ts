import { rateLimit } from '@/lib/rate-limit';
import { insideIndia } from '@/lib/location';

/**
 * Server-only access to OpenStreetMap's Nominatim geocoder.
 *
 * Policy: at most 1 request/second for the whole app and an identifying
 * User-Agent. Every call waits for the app-wide slot; results are cached by
 * Next for 30 days per URL. The browser never talks to Nominatim directly
 * (and the CSP wouldn't let it).
 */

const USER_AGENT = 'Vital/1.0 (https://vitalapp.in; sachin@vitalapp.in)';
const BASE = 'https://nominatim.openstreetmap.org';

/** Why a geocoder call failed: our 1/s slot was taken, the service refused us (403/429), it was too slow, or it was down. */
export type UpstreamReason = 'busy' | 'refused' | 'timeout' | 'unreachable' | 'status';

export class UpstreamError extends Error {
    constructor(message: string, readonly reason: UpstreamReason = 'status') {
        super(message);
    }
}

export interface CallOptions {
    /** Abort the HTTP request after this long (default 8 s). */
    timeoutMs?: number;
    /** How many times to try for the app-wide 1/s slot, ~1.1 s apart (default 4). */
    slotAttempts?: number;
}

export interface Place {
    latitude: number;
    longitude: number;
    /** The feature's own name ("General Hospital Ernakulam"), if it has one. */
    name?: string | null;
    /** Short, human name: "Kakkanad, Kochi". */
    label: string;
    /** Full name as Nominatim gives it. */
    displayName: string;
    city: string | null;
    district: string | null;
    state: string | null;
    zipcode: string | null;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function nominatimSlot(attempts: number): Promise<boolean> {
    for (let attempt = 0; attempt < attempts; attempt++) {
        if (await rateLimit('nominatim:global', 1, 1)) return true;
        if (attempt < attempts - 1) await sleep(1100);
    }
    return false;
}

async function call(path: string, { timeoutMs = 8000, slotAttempts = 4 }: CallOptions = {}): Promise<unknown> {
    if (!(await nominatimSlot(Math.max(1, slotAttempts)))) throw new UpstreamError('geocoder busy', 'busy');
    let response: Response;
    try {
        response = await fetch(`${BASE}${path}`, {
            headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en' },
            signal: AbortSignal.timeout(timeoutMs),
            next: { revalidate: 60 * 60 * 24 * 30 },
        });
    } catch (error) {
        const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
        throw new UpstreamError(timedOut ? 'geocoder timeout' : 'geocoder unreachable', timedOut ? 'timeout' : 'unreachable');
    }
    if (!response.ok) {
        const refused = response.status === 403 || response.status === 429;
        throw new UpstreamError(`geocoder status ${response.status}`, refused ? 'refused' : 'status');
    }
    return response.json().catch(() => null);
}

type Raw = {
    lat?: string; lon?: string; display_name?: string; name?: string;
    address?: Record<string, string | undefined>;
};

const PIN = /^[1-9][0-9]{5}$/;

function toPlace(raw: Raw): Place | null {
    const latitude = Number(raw?.lat);
    const longitude = Number(raw?.lon);
    if (!insideIndia(latitude, longitude)) return null;
    const a = raw.address ?? {};
    if (a.country_code && a.country_code !== 'in') return null;
    const city = a.city ?? a.town ?? a.municipality ?? a.village ?? a.city_district ?? null;
    const locality = a.suburb ?? a.neighbourhood ?? a.quarter ?? a.hamlet ?? a.village ?? null;
    const district = a.state_district ?? a.county ?? null;
    const postcode = (a.postcode ?? '').replace(/\s/g, '');
    const parts = [raw.name && raw.name !== locality && raw.name !== city ? raw.name : null, locality, city ?? district]
        .filter((p, i, all): p is string => !!p && all.indexOf(p) === i);
    const displayName = raw.display_name ?? '';
    return {
        latitude,
        longitude,
        name: raw.name?.trim() || null,
        label: (parts.length ? parts.join(', ') : displayName.split(',').slice(0, 2).join(',')).slice(0, 120),
        displayName: displayName.slice(0, 300),
        city,
        district,
        state: a.state ?? null,
        zipcode: PIN.test(postcode) ? postcode : null,
    };
}

/** Forward search inside India. `params` is a ready query string (q=…, postalcode=…, city=…). */
export async function searchPlaces(params: string, limit = 1, options?: CallOptions): Promise<Place[]> {
    const n = Math.min(Math.max(Math.trunc(limit), 1), 5);
    const data = await call(`/search?format=jsonv2&addressdetails=1&countrycodes=in&limit=${n}&${params}`, options);
    if (!Array.isArray(data)) return [];
    return data.filter(d => d && typeof d === 'object').map(d => toPlace(d as Raw)).filter((p): p is Place => p !== null);
}

/**
 * The locality around a point. Coordinates are rounded to 3 dp (~100 m)
 * before they leave our server, so OSM never receives a donor's exact spot.
 */
export async function reversePlace(latitude: number, longitude: number, options?: CallOptions): Promise<Place | null> {
    if (!insideIndia(latitude, longitude)) return null;
    const lat = latitude.toFixed(3);
    const lon = longitude.toFixed(3);
    const data = await call(`/reverse?format=jsonv2&addressdetails=1&zoom=16&lat=${lat}&lon=${lon}`, options);
    if (!data || typeof data !== 'object' || 'error' in data) return null;
    const place = toPlace(data as Raw);
    // Report the point that was asked about, not the matched feature's centre.
    return place ? { ...place, latitude, longitude } : null;
}
