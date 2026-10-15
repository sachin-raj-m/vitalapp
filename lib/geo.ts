/**
 * Matching radius for alerts and "Donors near you", in km.
 *
 * The database has its own copy, public.match_radius_km()
 * (supabase/migrations/20261017000300_radius_matching.sql); keep the two equal.
 * supabase/tests/radius.test.sql checks the database value.
 */
export const MATCH_RADIUS_KM = 25;

type Coords = { latitude?: unknown; longitude?: unknown } | null | undefined;

/**
 * True when a stored location can be used for distance matching: finite
 * numbers inside India's bounding box. Mirrors public.location_in_india(), so
 * NULL and the legacy {0, 0} placeholder are never usable.
 */
export function hasUsableLocation(location: Coords): location is { latitude: number; longitude: number } {
    if (!location || typeof location !== 'object') return false;
    const lat = Number(location.latitude);
    const lng = Number(location.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng)
        && lat >= 6 && lat <= 37.5 && lng >= 68 && lng <= 97.5;
}
