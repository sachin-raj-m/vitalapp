/**
 * Location helpers shared by the browser and the server.
 *
 * profiles.location (private to the donor, admins and the server) is
 * normalised by the database (20261017000200_precise_location):
 *   { latitude, longitude, source, accuracy_m, label?, updated_at }
 * Other users only ever see it rounded to ~1 km (approx_location()).
 */

export type LocationSource = 'gps' | 'manual' | 'pin' | 'city';

export interface StoredLocation {
    latitude: number;
    longitude: number;
    source?: LocationSource;
    accuracy_m?: number;
    label?: string;
    updated_at?: string;
}

// India's bounding box (generous), the same as public.location_in_india().
const IN_LAT: [number, number] = [6, 37.5];
const IN_LNG: [number, number] = [68, 97.5];

export function insideIndia(lat: number, lng: number): boolean {
    return Number.isFinite(lat) && Number.isFinite(lng)
        && lat >= IN_LAT[0] && lat <= IN_LAT[1] && lng >= IN_LNG[0] && lng <= IN_LNG[1];
}

/** A stored location that is a real place in India (not null, not the old (0,0) placeholder). */
export function usableLocation(value: unknown): StoredLocation | null {
    if (!value || typeof value !== 'object') return null;
    const v = value as Record<string, unknown>;
    const lat = Number(v.latitude);
    const lng = Number(v.longitude);
    if (!insideIndia(lat, lng)) return null;
    return {
        latitude: lat,
        longitude: lng,
        source: typeof v.source === 'string' ? (v.source as LocationSource) : undefined,
        accuracy_m: Number.isFinite(Number(v.accuracy_m)) ? Number(v.accuracy_m) : undefined,
        label: typeof v.label === 'string' ? v.label : undefined,
        updated_at: typeof v.updated_at === 'string' ? v.updated_at : undefined,
    };
}

/** Set from the device or placed on a map, rather than a PIN code or city centre. */
export function isPrecise(location: StoredLocation | null): boolean {
    return !!location && (location.source === 'gps' || location.source === 'manual');
}

/** "about 30 m", "about 1.2 km". */
export function describeAccuracy(metres: number | undefined): string | null {
    if (metres === undefined || !Number.isFinite(metres)) return null;
    if (metres < 1000) return `about ${Math.max(10, Math.round(metres / 10) * 10)} m`;
    return `about ${(metres / 1000).toFixed(metres < 10000 ? 1 : 0)} km`;
}

export function describeSource(source: LocationSource | undefined): string {
    switch (source) {
        case 'gps': return 'from your device';
        case 'manual': return 'placed by you on the map';
        case 'pin': return 'the centre of your PIN code area';
        case 'city': return 'the centre of your city';
        default: return 'saved location';
    }
}

/** Great-circle distance in kilometres. */
export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(bLat - aLat);
    const dLng = toRad(bLng - aLng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Device positions rougher than this are refused (IP-based desktop guesses can be a whole city off). */
export const MAX_GPS_ACCURACY_M = 5000;

export class GeolocationFailure extends Error {}

/**
 * Asks the browser for the current position once (high accuracy). Only call
 * it from a user action: the browser shows its own permission prompt.
 */
export function getDevicePosition(): Promise<{ latitude: number; longitude: number; accuracy: number }> {
    return new Promise((resolve, reject) => {
        if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
            reject(new GeolocationFailure('Your browser can’t share your location. Use your PIN code or place yourself on the map instead.'));
            return;
        }
        navigator.geolocation.getCurrentPosition(
            pos => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy }),
            err => {
                const message = err.code === err.PERMISSION_DENIED
                    ? 'Location access is blocked for Vital. Allow it in your browser’s site settings, or place yourself on the map instead.'
                    : err.code === err.POSITION_UNAVAILABLE
                        ? 'Your device couldn’t find your position. Try again outdoors, or place yourself on the map instead.'
                        : 'Finding your position took too long. Try again, or place yourself on the map instead.';
                reject(new GeolocationFailure(message));
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
        );
    });
}
