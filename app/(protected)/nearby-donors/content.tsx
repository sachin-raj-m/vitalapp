"use client";

import React, { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { MapPin, Navigation } from 'lucide-react';
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
    full_name: string;
    blood_group: string;
    location: {
        latitude: number;
        longitude: number;
        address?: string;
    };
    present_zip?: string;
    distanceKm?: number;
}

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

// public_donors already returns "First L." names and ~1 km locations; rounding
// again here also covers locations geocoded from a PIN code.
const coarse = (n: number) => Math.round(n * 100) / 100;

export default function NearbyDonorsPageContent() {
    const { user } = useAuth();
    const [center, setCenter] = useState<{ lat: number; lng: number }>({ lat: 20.5937, lng: 78.9629 });
    const [donors, setDonors] = useState<Donor[]>([]);
    const [nearbyDonors, setNearbyDonors] = useState<Donor[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [status, setStatus] = useState<string>('');

    // Cache for zip code coordinates to avoid rate limiting
    const [zipCache, setZipCache] = useState<Record<string, { lat: number, lng: number }>>({});

    // Fetch donors on mount
    useEffect(() => {
        const fetchDonors = async () => {
            try {
                // public_donors exposes only a display name, blood group, PIN code
                // and a location already rounded to ~1 km.
                const { data, error } = await supabase
                    .from('public_donors')
                    .select('id, display_name, blood_group, approx_location, present_zip');

                if (error) throw error;

                let parsedDonors = (data || []).map((d: any) => ({
                    id: d.id,
                    full_name: d.display_name,
                    blood_group: d.blood_group,
                    present_zip: d.present_zip,
                    location: d.approx_location || {},
                }));

                // Identify unique zips that need geocoding (where lat/lng is 0 or missing)
                const zipsToGeocode = new Set<string>();
                parsedDonors.forEach(d => {
                    if ((!d.location?.latitude || d.location.latitude === 0) && d.present_zip) {
                        zipsToGeocode.add(d.present_zip);
                    }
                });

                // Geocode zips if they are not in cache
                const newZipCache = { ...zipCache };
                let cacheUpdated = false;

                // We'll process zips sequentially to be nice to the free API
                // Limit to 5 zips per batch to avoid lagging the UI too much on load
                const zipsArray = Array.from(zipsToGeocode).slice(0, 5);

                for (const zip of zipsArray) {
                    if (newZipCache[zip]) continue;

                    try {
                        const response = await fetch(`/api/geocode?zip=${zip}`, {
                            headers: {
                                'Content-Type': 'application/json'
                            }
                        });
                        const results = await response.json();
                        if (results && results.length > 0) {
                            newZipCache[zip] = {
                                lat: parseFloat(results[0].lat),
                                lng: parseFloat(results[0].lon)
                            };
                            cacheUpdated = true;
                            // Small delay to respect rate limit
                            await new Promise(r => setTimeout(r, 800));
                        }
                    } catch (e) {
                        console.error(`Failed to geocode zip ${zip}`, e);
                    }
                }

                if (cacheUpdated) {
                    setZipCache(newZipCache);
                }

                // Assign coordinates from cache if original location is missing
                const donosWithLocation = parsedDonors.map(d => {
                    if ((!d.location?.latitude || d.location.latitude === 0) && d.present_zip && newZipCache[d.present_zip]) {
                        return {
                            ...d,
                            location: {
                                ...d.location,
                                latitude: newZipCache[d.present_zip].lat,
                                longitude: newZipCache[d.present_zip].lng,
                                address: d.location?.address || `Zip: ${d.present_zip}`
                            }
                        };
                    }
                    return d;
                });

                setDonors(donosWithLocation as Donor[]);
            } catch (err: any) {
                console.error("Error fetching donors", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchDonors();
    }, []);

    // Get user location
    const getUserLocation = useCallback(() => {
        setStatus('Locating...');
        if (!("geolocation" in navigator)) {
            setError("Geolocation not supported by your browser.");
            setStatus('');
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                setStatus('');
            },
            (err) => {
                setError("Unable to get your location: " + err.message);
                setStatus('');
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    }, []);

    // Get User Profile for Zip Code
    useEffect(() => {
        const fetchUserProfile = async () => {
            if (!user) return;
            const { data, error } = await supabase
                .from('profiles')
                .select('present_zip')
                .eq('id', user.id)
                .single();

            if (data?.present_zip) {
                // Try to geocode the zip immediately
                try {
                    const response = await fetch(`/api/geocode?zip=${data.present_zip}`, {
                        headers: { 'Content-Type': 'application/json' }
                    });
                    const results = await response.json();
                    if (results && results.length > 0) {
                        setCenter({
                            lat: parseFloat(results[0].lat),
                            lng: parseFloat(results[0].lon)
                        });
                    }
                } catch (e) {
                    console.error("Failed to set initial center from zip", e);
                }
            }
        };
        fetchUserProfile();
    }, [user]);

    // Auto-trigger Geolocation on mount
    useEffect(() => {
        getUserLocation();
    }, [getUserLocation]);

    // Calculate distances when center or donors change
    useEffect(() => {
        // Filter out donors with invalid location AND the current user
        const validDonors = donors.filter(d =>
            d.id !== user?.id && // Exclude current user
            d.location &&
            d.location.latitude !== undefined && d.location.latitude !== null &&
            d.location.longitude !== undefined && d.location.longitude !== null
        );

        const withDistance = validDonors.map(d => {
            const location = { ...d.location, latitude: coarse(d.location.latitude), longitude: coarse(d.location.longitude) };
            const dist = haversineDistanceKm(center.lat, center.lng, location.latitude, location.longitude);
            return { ...d, location, distanceKm: dist };
        });

        // Sort by distance and take top 20
        const sorted = withDistance.sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));
        setNearbyDonors(sorted.slice(0, 20));

    }, [center, donors, user]);

    if (loading) {
        return <NearbyDonorsSkeleton />;
    }

    return (
        <div className="space-y-6">
            <header className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
                <div>
                    <p className="eyebrow">Donors nearby</p>
                    <h1 className="display mt-3 text-5xl leading-none">Who’s around you.</h1>
                    <p className="mt-3 max-w-lg text-sm text-gray-600">
                        The 20 registered donors closest to you. Locations are approximate, and contact details are never shown here.
                    </p>
                </div>
                <Button
                    variant="secondary"
                    onClick={getUserLocation}
                    isLoading={!!status}
                    leftIcon={<Navigation className="h-3.5 w-3.5" />}
                    className="self-start sm:self-auto"
                >
                    {status || 'Use my location'}
                </Button>
            </header>

            {error && <Alert variant="error" onClose={() => setError('')}>{error}</Alert>}

            <div className="grid overflow-hidden rounded-lg border border-gray-200 bg-white lg:h-[calc(100vh-17rem)] lg:min-h-[480px] lg:grid-cols-[1fr_340px]">
                <div className="relative z-0 h-[300px] border-b border-gray-200 lg:h-full lg:border-b-0 lg:border-r">
                    <Map
                        center={center}
                        zoom={11}
                        markers={[
                            { position: center, title: 'You are here' },
                            ...nearbyDonors.map(d => ({
                                position: { lat: d.location.latitude, lng: d.location.longitude },
                                title: `${d.full_name} · ${formatBloodGroup(d.blood_group)}`,
                                description: `About ${d.distanceKm?.toFixed(1)} km away`
                            }))
                        ]}
                    />
                </div>

                <div className="flex min-h-0 flex-col">
                    <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
                        <span className="eyebrow">Closest first</span>
                        <span className="font-mono text-xs text-gray-500">{nearbyDonors.length}</span>
                    </div>
                    <ul className="max-h-[420px] flex-1 divide-y divide-gray-200 overflow-y-auto lg:max-h-none">
                        {nearbyDonors.length === 0 ? (
                            <li className="px-5 py-12 text-center">
                                <MapPin className="mx-auto h-5 w-5 text-gray-400" strokeWidth={1.75} />
                                <p className="mt-3 text-sm font-medium text-gray-900">No donors found nearby</p>
                                <p className="mt-1 text-sm text-gray-500">Try using your current location.</p>
                            </li>
                        ) : nearbyDonors.map(donor => (
                            <li key={donor.id}>
                                <button
                                    onClick={() => setCenter({ lat: donor.location.latitude, lng: donor.location.longitude })}
                                    className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-gray-50"
                                >
                                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-gray-100 font-serif text-xl tracking-tight text-gray-900">
                                        {formatBloodGroup(donor.blood_group)}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-medium text-gray-900">{donor.full_name}</span>
                                        <span className="block font-mono text-[11px] text-gray-500">{donor.present_zip || 'PIN code not set'}</span>
                                    </span>
                                    <span className="shrink-0 font-mono text-xs text-gray-600">{donor.distanceKm?.toFixed(1)} km</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
}
