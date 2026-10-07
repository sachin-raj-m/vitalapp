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
    display_name: string;
    blood_group: string;
    // ~1 km, rounded in SQL; null when the donor has no stored coordinates.
    location: { latitude: number; longitude: number } | null;
    // First 3 PIN digits (sorting district), never the full PIN code.
    area_code: string | null;
}

type PlacedDonor = Donor & { location: { latitude: number; longitude: number }; distanceKm: number };

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

export default function NearbyDonorsPageContent() {
    const { user } = useAuth();
    const [center, setCenter] = useState<{ lat: number; lng: number }>({ lat: 20.5937, lng: 78.9629 });
    const [donors, setDonors] = useState<Donor[]>([]);
    const [nearbyDonors, setNearbyDonors] = useState<PlacedDonor[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [status, setStatus] = useState<string>('');

    // Fetch donors on mount
    useEffect(() => {
        const fetchDonors = async () => {
            try {
                // nearby_donors() returns a masked name ("First L."), blood group,
                // a coarse area code and a location rounded to ~1 km. Donors with
                // no stored coordinates can't be placed and are left off the map.
                const { data, error } = await supabase.rpc('nearby_donors');
                if (error) throw error;

                setDonors((data || []).map((d: any): Donor => {
                    const lat = Number(d.approx_location?.latitude);
                    const lng = Number(d.approx_location?.longitude);
                    return {
                        id: d.id,
                        display_name: d.display_name || 'Donor',
                        blood_group: d.blood_group,
                        area_code: d.area_code ?? null,
                        location: d.approx_location && Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)
                            ? { latitude: lat, longitude: lng }
                            : null,
                    };
                }));
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
        const placed: PlacedDonor[] = donors
            .filter((d): d is Donor & { location: { latitude: number; longitude: number } } =>
                d.id !== user?.id && d.location !== null)
            .map(d => ({
                ...d,
                distanceKm: haversineDistanceKm(center.lat, center.lng, d.location.latitude, d.location.longitude),
            }));

        // Sort by distance and take top 20
        placed.sort((a, b) => a.distanceKm - b.distanceKm);
        setNearbyDonors(placed.slice(0, 20));

    }, [center, donors, user]);

    if (loading) {
        return <NearbyDonorsSkeleton />;
    }

    return (
        <div className="space-y-6">
            <header className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
                <div>
                    <h1 className="display text-4xl sm:text-[2.75rem]">Donors near you</h1>
                    <p className="mt-3 max-w-lg text-gray-600">
                        The 20 registered donors closest to you. Names are shortened, locations are rounded to about a kilometre, and only the first three digits of a PIN code are shown. Contact details are never shown here.
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
                                title: `${d.display_name} · ${formatBloodGroup(d.blood_group)}`,
                                description: `About ${d.distanceKm.toFixed(1)} km away`
                            }))
                        ]}
                    />
                </div>

                <div className="flex min-h-0 flex-col">
                    <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
                        <span className="text-sm font-medium text-gray-900">Nearest donors</span>
                        <span className="text-sm tabular-nums text-gray-500">{nearbyDonors.length} shown</span>
                    </div>
                    <ul className="max-h-[420px] flex-1 divide-y divide-gray-200 overflow-y-auto lg:max-h-none">
                        {nearbyDonors.length === 0 ? (
                            <li className="px-5 py-12 text-center">
                                <MapPin className="mx-auto h-5 w-5 text-gray-500" strokeWidth={1.75} />
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
                                        <span className="block truncate text-sm font-medium text-gray-900">{donor.display_name}</span>
                                        {donor.area_code && (
                                            <span className="block text-xs text-gray-500">PIN area {donor.area_code}xxx</span>
                                        )}
                                    </span>
                                    <span className="shrink-0 text-sm tabular-nums text-gray-600">~{donor.distanceKm.toFixed(1)} km</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
}
