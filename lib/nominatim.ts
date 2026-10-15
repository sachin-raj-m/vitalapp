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

export class UpstreamError extends Error {}

export interface Place {
    latitude: number;
    longitude: number;
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

async function nominatimSlot(): Promise<boolean> {
    for (let attempt = 0; attempt < 4; attempt++) {
        if (await rateLimit('nominatim:global', 1, 1)) return true;
        await sleep(1100);
    }
    return false;
}

async function call(path: string): Promise<unknown> {
    if (!(await nominatimSlot())) throw new UpstreamError('geocoder busy');
    let response: Response;
    try {
        response = await fetch(`${BASE}${path}`, {
            headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en' },
            signal: AbortSignal.timeout(8000),
            next: { revalidate: 60 * 60 * 24 * 30 },
        });
    } catch {
        throw new UpstreamError('geocoder unreachable');
    }
    if (!response.ok) throw new UpstreamError(`geocoder status ${response.status}`);
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
        label: (parts.length ? parts.join(', ') : displayName.split(',').slice(0, 2).join(',')).slice(0, 120),
        displayName: displayName.slice(0, 300),
        city,
        district,
        state: a.state ?? null,
        zipcode: PIN.test(postcode) ? postcode : null,
    };
}

/** Forward search inside India. `params` is a ready query string (q=…, postalcode=…, city=…). */
export async function searchPlaces(params: string, limit = 1): Promise<Place[]> {
    const n = Math.min(Math.max(Math.trunc(limit), 1), 5);
    const data = await call(`/search?format=jsonv2&addressdetails=1&countrycodes=in&limit=${n}&${params}`);
    if (!Array.isArray(data)) return [];
    return data.map(d => toPlace(d as Raw)).filter((p): p is Place => p !== null);
}

/**
 * The locality around a point. Coordinates are rounded to 3 dp (~100 m)
 * before they leave our server, so OSM never receives a donor's exact spot.
 */
export async function reversePlace(latitude: number, longitude: number): Promise<Place | null> {
    if (!insideIndia(latitude, longitude)) return null;
    const lat = latitude.toFixed(3);
    const lon = longitude.toFixed(3);
    const data = await call(`/reverse?format=jsonv2&addressdetails=1&zoom=16&lat=${lat}&lon=${lon}`);
    if (!data || typeof data !== 'object' || 'error' in data) return null;
    const place = toPlace(data as Raw);
    // Report the point that was asked about, not the matched feature's centre.
    return place ? { ...place, latitude, longitude } : null;
}
