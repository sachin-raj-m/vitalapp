"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { MapPin, Navigation, Search } from 'lucide-react';
import { formatBloodGroup } from '@/lib/blood-compatibility';
import { Alert } from '@/components/ui/Alert';
import { useAuth } from '@/context/AuthContext';
import { NearbyDonorsSkeleton } from './skeleton';

const Map = dynamic(() => import('@/components/Map'), {
    ssr: false,
    loading: () => <div className="h-full w-full animate-pulse bg-gray-100" />
});

interface Donor {
    id: string;
    // Masked by the server ("First L."); rendered as-is, never rebuilt here.
    display_name: string;
    blood_group: string;
    // ~1 km, rounded in SQL; null when the donor has no usable coordinates.
    location: { latitude: number; longitude: number } | null;
    // First 3 PIN digits (sorting district), never the full PIN code.
    area_code: string | null;
}

type LatLng = { lat: number; lng: number };
type PlacedDonor = Donor & { location: { latitude: number; longitude: number }; distanceKm: number };

type CentreKind = 'default' | 'profile-pin' | 'pin' | 'city' | 'gps';
interface Centre extends LatLng {
    kind: CentreKind;
    label: string;
    // First 3 PIN digits of the centre, when known; used to rank donors
    // that have an area code but no coordinates.
    areaCode: string | null;
}

const MAX_LIST = 20;
const INDIA_CENTRE: Centre = { lat: 20.5937, lng: 78.9629, kind: 'default', label: 'India', areaCode: null };
const GEO_WATCHDOG_MS = 20000;

function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const toRad = (v: number) => (v * Math.PI) / 180;
    const R = 6371; // Earth radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// ---------------------------------------------------------------------------
// Geocoding via /api/geocode, cached per tab in sessionStorage.
// ---------------------------------------------------------------------------
class GeocodeError extends Error {}

function readCache(key: string): LatLng | null {
    try {
        const raw = sessionStorage.getItem(key);
        if (!raw) return null;
        const v = JSON.parse(raw);
        return Number.isFinite(v?.lat) && Number.isFinite(v?.lng) ? { lat: v.lat, lng: v.lng } : null;
    } catch {
        return null;
    }
}

function writeCache(key: string, value: LatLng) {
    try {
        sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Storage can be unavailable (private mode, blocked site data); the cache is optional.
    }
}

async function fetchGeocode(param: 'zip' | 'city' | 'q', value: string): Promise<LatLng | null> {
    const res = await fetch(`/api/geocode?${param}=${encodeURIComponent(value)}`);
    if (res.status === 429) throw new GeocodeError('Too many searches. Please wait a minute and try again.');
    if (res.status === 400) throw new GeocodeError('That doesn’t look like a valid PIN code or city.');
    if (!res.ok) throw new GeocodeError('The location service is unavailable right now. Please try again shortly.');
    const results = await res.json();
    if (!Array.isArray(results) || results.length === 0) return null;
    const lat = parseFloat(results[0].lat);
    const lng = parseFloat(results[0].lon);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

async function geocodePin(pin: string): Promise<LatLng | null> {
    const key = `vital:geocode:pin:${pin}`;
    const cached = readCache(key);
    if (cached) return cached;
    // Nominatim's postal-code index is patchy for India, so fall back to a free-text search.
    const hit = (await fetchGeocode('zip', pin)) ?? (await fetchGeocode('q', `${pin} India`));
    if (hit) writeCache(key, hit);
    return hit;
}

async function geocodeCity(city: string): Promise<LatLng | null> {
    const key = `vital:geocode:city:${city.toLowerCase()}`;
    const cached = readCache(key);
    if (cached) return cached;
    const hit = (await fetchGeocode('city', city)) ?? (await fetchGeocode('q', `${city}, India`));
    if (hit) writeCache(key, hit);
    return hit;
}

function geolocationMessage(err: GeolocationPositionError | null) {
    if (!err) return 'We couldn’t get your location in time. Search by PIN code or city instead.';
    switch (err.code) {
        case err.PERMISSION_DENIED:
            return 'Location access is blocked. Allow it in your browser settings, or search by PIN code or city instead.';
        case err.POSITION_UNAVAILABLE:
            return 'Your location isn’t available right now. Search by PIN code or city instead.';
        case err.TIMEOUT:
        default:
            return 'We couldn’t get your location in time. Search by PIN code or city instead.';
    }
}

function areaDistance(a: string | null, b: string | null) {
    if (!a || !b) return Number.POSITIVE_INFINITY;
    return Math.abs(parseInt(a, 10) - parseInt(b, 10));
}

export default function NearbyDonorsPageContent() {
    const { user } = useAuth();
    const userId = user?.id;

    const [donors, setDonors] = useState<Donor[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');

    const [centre, setCentre] = useState<Centre>(INDIA_CENTRE);
    const [resolvingProfile, setResolvingProfile] = useState(true);
    const [focus, setFocus] = useState<LatLng | null>(null);

    const [locating, setLocating] = useState(false);
    const [geoError, setGeoError] = useState('');

    const [query, setQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const [searchError, setSearchError] = useState('');

    // Once the user picks a centre (GPS or search), a late profile-PIN lookup must not override it.
    const userChoseCentre = useRef(false);
    const geoWatchdog = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Donors: loaded once, independent of any location lookup.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                // nearby_donors() returns a masked name ("First L."), blood group,
                // a coarse area code and a location rounded to ~1 km (or null).
                const { data, error } = await supabase.rpc('nearby_donors');
                if (error) throw error;
                if (cancelled) return;
                setDonors((data || []).map((d: any): Donor => {
                    const lat = Number(d.approx_location?.latitude);
                    const lng = Number(d.approx_location?.longitude);
                    return {
                        id: d.id,
                        display_name: d.display_name || 'Donor',
                        blood_group: d.blood_group,
                        area_code: d.area_code ?? null,
                        // (0, 0) is a legacy placeholder, not a real position.
                        location: d.approx_location && Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)
                            ? { latitude: lat, longitude: lng }
                            : null,
                    };
                }));
            } catch (err: any) {
                console.error('Error fetching donors', err);
                if (!cancelled) setLoadError('We couldn’t load donors. Please refresh the page to try again.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    // Initial centre: the user's profile PIN code (geocoded once per tab), else India.
    // Never prompts for geolocation on its own.
    useEffect(() => {
        if (!userId) return;
        let cancelled = false;
        (async () => {
            try {
                const { data } = await supabase
                    .from('profiles')
                    .select('present_zip')
                    .eq('id', userId)
                    .maybeSingle();
                const pin = typeof data?.present_zip === 'string' ? data.present_zip.trim() : '';
                if (!/^[0-9]{6}$/.test(pin)) return;
                const area = pin.slice(0, 3);
                const hit = await geocodePin(pin).catch(() => null);
                if (cancelled || userChoseCentre.current) return;
                if (hit) {
                    setCentre({ ...hit, kind: 'profile-pin', label: `your PIN code (${area}xxx)`, areaCode: area });
                } else {
                    // Still rank by PIN area even if the map can't be centred on it.
                    setCentre({ ...INDIA_CENTRE, kind: 'profile-pin', label: `your PIN area ${area}xxx`, areaCode: area });
                }
            } catch (e) {
                console.error('Failed to set initial centre from PIN code', e);
            } finally {
                if (!cancelled) setResolvingProfile(false);
            }
        })();
        return () => { cancelled = true; };
    }, [userId]);

    useEffect(() => () => {
        if (geoWatchdog.current) clearTimeout(geoWatchdog.current);
    }, []);

    const applyCentre = useCallback((next: Centre) => {
        userChoseCentre.current = true;
        setResolvingProfile(false);
        setFocus(null);
        setCentre(next);
    }, []);

    const locateMe = useCallback(() => {
        setGeoError('');
        if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
            setGeoError('Your browser can’t share your location. Search by PIN code or city instead.');
            return;
        }
        setLocating(true);
        let settled = false;
        const finish = () => {
            settled = true;
            setLocating(false);
            if (geoWatchdog.current) clearTimeout(geoWatchdog.current);
            geoWatchdog.current = null;
        };
        // Browsers don't start the timeout until the permission prompt is answered,
        // so an ignored prompt would otherwise leave the button spinning forever.
        if (geoWatchdog.current) clearTimeout(geoWatchdog.current);
        geoWatchdog.current = setTimeout(() => {
            if (settled) return;
            finish();
            setGeoError(geolocationMessage(null));
        }, GEO_WATCHDOG_MS);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                if (settled) return;
                finish();
                applyCentre({ lat: pos.coords.latitude, lng: pos.coords.longitude, kind: 'gps', label: 'your location', areaCode: null });
            },
            (err) => {
                if (settled) return;
                finish();
                setGeoError(geolocationMessage(err));
            },
            { enableHighAccuracy: false, timeout: 15000, maximumAge: 5 * 60 * 1000 }
        );
    }, [applyCentre]);

    const onSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        setSearchError('');
        const value = query.trim().replace(/\s+/g, ' ');
        if (!value) {
            setSearchError('Enter a 6-digit PIN code or a city name.');
            return;
        }
        const digits = value.replace(/\s/g, '');
        const isPin = /^[0-9]+$/.test(digits);
        if (isPin && digits.length !== 6) {
            setSearchError('PIN codes have 6 digits.');
            return;
        }
        if (!isPin && (value.length < 2 || value.length > 100 || !/^[\p{L}][\p{L}\s.'-]*$/u.test(value))) {
            setSearchError('Enter a city name using letters only, or a 6-digit PIN code.');
            return;
        }
        setSearching(true);
        try {
            const hit = isPin ? await geocodePin(digits) : await geocodeCity(value);
            if (!hit) {
                setSearchError(isPin
                    ? `We couldn’t find PIN code ${digits}. Check it, or try a city name.`
                    : `We couldn’t find “${value}”. Check the spelling, or try a PIN code.`);
                return;
            }
            applyCentre(isPin
                ? { ...hit, kind: 'pin', label: `PIN ${digits}`, areaCode: digits.slice(0, 3) }
                : { ...hit, kind: 'city', label: value.replace(/\b\p{L}/gu, c => c.toUpperCase()), areaCode: null });
            setGeoError('');
        } catch (err) {
            setSearchError(err instanceof GeocodeError ? err.message : 'Search failed. Check your connection and try again.');
        } finally {
            setSearching(false);
        }
    };

    // Donors with coordinates, nearest first; donors without, ranked by PIN area.
    const { placed, unplaced } = useMemo(() => {
        const others = donors.filter(d => d.id !== userId);
        const placed: PlacedDonor[] = others
            .filter((d): d is Donor & { location: { latitude: number; longitude: number } } => d.location !== null)
            .map(d => ({
                ...d,
                distanceKm: haversineDistanceKm(centre.lat, centre.lng, d.location.latitude, d.location.longitude),
            }))
            .sort((a, b) => a.distanceKm - b.distanceKm)
            .slice(0, MAX_LIST);
        const unplaced = others
            .filter(d => d.location === null)
            .sort((a, b) => {
                const da = areaDistance(a.area_code, centre.areaCode);
                const db = areaDistance(b.area_code, centre.areaCode);
                if (da !== db) return da - db;
                if (!!a.area_code !== !!b.area_code) return a.area_code ? -1 : 1;
                return (a.area_code ?? '').localeCompare(b.area_code ?? '');
            })
            .slice(0, MAX_LIST);
        return { placed, unplaced };
    }, [donors, userId, centre]);

    if (loading) {
        return <NearbyDonorsSkeleton />;
    }

    const centreText = resolvingProfile
        ? 'Finding your area…'
        : centre.kind === 'default'
            ? 'No location set. Search by PIN code or city to sort donors by distance.'
            : `Showing donors near ${centre.label}`;
    const isDefault = centre.kind === 'default';
    const mapCentre = focus ?? { lat: centre.lat, lng: centre.lng };
    const total = placed.length + unplaced.length;

    return (
        <div className="space-y-6">
            <header className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
                <div>
                    <h1 className="display text-4xl sm:text-[2.75rem]">Donors near you</h1>
                    <p className="mt-3 max-w-lg text-gray-600">
                        Registered donors closest to the place you choose. Names are shortened, locations are rounded to about a kilometre, and only the first three digits of a PIN code are shown. Contact details are never shown here.
                    </p>
                </div>
                <Button
                    variant="secondary"
                    onClick={locateMe}
                    isLoading={locating}
                    leftIcon={<Navigation className="h-3.5 w-3.5" />}
                    className="self-start sm:self-auto"
                >
                    {locating ? 'Locating…' : 'Use my location'}
                </Button>
            </header>

            <div className="space-y-3">
                <form onSubmit={onSearch} noValidate className="flex flex-col gap-2 sm:flex-row sm:items-start">
                    <div className="flex-1">
                        <label htmlFor="nearby-search" className="sr-only">Search near a PIN code or city</label>
                        <input
                            id="nearby-search"
                            type="text"
                            inputMode="text"
                            autoComplete="postal-code"
                            maxLength={100}
                            placeholder="Search near a PIN code or city"
                            value={query}
                            onChange={(e) => { setQuery(e.target.value); if (searchError) setSearchError(''); }}
                            aria-invalid={!!searchError || undefined}
                            aria-describedby={searchError ? 'nearby-search-error' : undefined}
                            className={`h-10 w-full rounded-md border bg-white px-3 text-[15px] text-gray-900 placeholder:text-gray-400 transition-colors focus:outline-none ${searchError ? 'border-red-500 focus:border-red-600' : 'border-gray-300 hover:border-gray-400 focus:border-gray-900'}`}
                        />
                        {searchError && <p id="nearby-search-error" className="mt-1.5 text-[13px] text-red-700">{searchError}</p>}
                    </div>
                    <Button
                        type="submit"
                        variant="ink"
                        isLoading={searching}
                        leftIcon={<Search className="h-3.5 w-3.5" />}
                        className="self-start"
                    >
                        Search
                    </Button>
                </form>

                <p className="flex items-center gap-2 text-sm text-gray-700" aria-live="polite">
                    <MapPin className="h-4 w-4 shrink-0 text-gray-500" strokeWidth={1.75} />
                    <span>{centreText}</span>
                </p>

                {geoError && <Alert variant="warning" onClose={() => setGeoError('')}>{geoError}</Alert>}
                {loadError && <Alert variant="error">{loadError}</Alert>}
            </div>

            <div className="grid overflow-hidden rounded-lg border border-gray-200 bg-white lg:h-[calc(100vh-17rem)] lg:min-h-[480px] lg:grid-cols-[1fr_340px]">
                <div className="relative z-0 h-[300px] border-b border-gray-200 lg:h-full lg:border-b-0 lg:border-r">
                    <Map
                        center={mapCentre}
                        zoom={isDefault ? 5 : 11}
                        markers={[
                            ...(isDefault ? [] : [{ position: { lat: centre.lat, lng: centre.lng }, title: centre.kind === 'gps' ? 'You are here' : `Near ${centre.label}` }]),
                            ...placed.map(d => ({
                                position: { lat: d.location.latitude, lng: d.location.longitude },
                                title: `${d.display_name} · ${formatBloodGroup(d.blood_group)}`,
                                description: isDefault ? undefined : `About ${d.distanceKm.toFixed(1)} km away`
                            }))
                        ]}
                    />
                </div>

                <div className="flex min-h-0 flex-col">
                    <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
                        <span className="text-sm font-medium text-gray-900">Nearest donors</span>
                        <span className="text-sm tabular-nums text-gray-500">{total} shown</span>
                    </div>
                    <ul className="max-h-[420px] flex-1 divide-y divide-gray-200 overflow-y-auto lg:max-h-none">
                        {total === 0 ? (
                            <li className="px-5 py-12 text-center">
                                <MapPin className="mx-auto h-5 w-5 text-gray-500" strokeWidth={1.75} />
                                <p className="mt-3 text-sm font-medium text-gray-900">
                                    {loadError ? 'Donors couldn’t be loaded' : 'No other donors registered yet'}
                                </p>
                                <p className="mt-1 text-sm text-gray-500">
                                    {loadError ? 'Refresh the page to try again.' : 'Check back soon as more donors join.'}
                                </p>
                            </li>
                        ) : (
                            <>
                                {placed.map(donor => (
                                    <li key={donor.id}>
                                        <button
                                            type="button"
                                            onClick={() => setFocus({ lat: donor.location.latitude, lng: donor.location.longitude })}
                                            className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-gray-50"
                                        >
                                            <DonorBadge bloodGroup={donor.blood_group} />
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-medium text-gray-900">{donor.display_name}</span>
                                                {donor.area_code && (
                                                    <span className="block text-xs text-gray-500">PIN area {donor.area_code}xxx</span>
                                                )}
                                            </span>
                                            {!isDefault && (
                                                <span className="shrink-0 text-sm tabular-nums text-gray-600">~{donor.distanceKm.toFixed(1)} km</span>
                                            )}
                                        </button>
                                    </li>
                                ))}
                                {unplaced.length > 0 && (
                                    <li className="bg-gray-50 px-5 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                                        Location not shared
                                    </li>
                                )}
                                {unplaced.map(donor => (
                                    <li key={donor.id} className="flex items-center gap-3 px-5 py-3">
                                        <DonorBadge bloodGroup={donor.blood_group} />
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-medium text-gray-900">{donor.display_name}</span>
                                            <span className="block text-xs text-gray-500">
                                                {donor.area_code ? `PIN area ${donor.area_code}xxx` : 'Area not shared'}
                                            </span>
                                        </span>
                                        {donor.area_code && centre.areaCode === donor.area_code && (
                                            <span className="shrink-0 text-xs font-medium text-gray-700">Same area</span>
                                        )}
                                    </li>
                                ))}
                            </>
                        )}
                    </ul>
                </div>
            </div>
        </div>
    );
}

function DonorBadge({ bloodGroup }: { bloodGroup: string }) {
    return (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-gray-100 font-serif text-xl tracking-tight text-gray-900">
            {formatBloodGroup(bloodGroup)}
        </span>
    );
}
