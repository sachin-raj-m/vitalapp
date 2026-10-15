"use client";

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { MapPin } from 'lucide-react';
import { formatBloodGroup } from '@/lib/blood-compatibility';
import { MATCH_RADIUS_KM, hasUsableLocation } from '@/lib/geo';
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
    // ~1 km, rounded in SQL.
    location: { latitude: number; longitude: number };
    // First 3 PIN digits (sorting district), never the full PIN code.
    area_code: string | null;
    // Whole km from the viewer, at least 1; computed in SQL from the rounded location.
    distance_km: number;
}

type LatLng = { lat: number; lng: number };

// One row of nearby_donors().
interface NearbyRow {
    id: string;
    display_name: string | null;
    blood_group: string;
    area_code: string | null;
    approx_location: { latitude: number; longitude: number } | null;
    distance_km: number | null;
}

// Your own saved location, rounded the same way donors' are; it only centres the map.
const round2 = (n: number) => Math.round(n * 100) / 100;

export default function NearbyDonorsPageContent() {
    const { user } = useAuth();
    const userId = user?.id;

    const [donors, setDonors] = useState<Donor[]>([]);
    const [centre, setCentre] = useState<LatLng | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [focus, setFocus] = useState<LatLng | null>(null);

    useEffect(() => {
        if (!userId) return;
        let cancelled = false;
        (async () => {
            try {
                // The radius is measured from the viewer's own saved location;
                // without one there is nothing to measure from.
                const { data: me, error: meError } = await supabase
                    .from('profiles')
                    .select('location')
                    .eq('id', userId)
                    .maybeSingle();
                if (meError) throw meError;
                if (cancelled) return;
                if (!hasUsableLocation(me?.location)) {
                    setCentre(null);
                    return;
                }
                setCentre({ lat: round2(Number(me.location.latitude)), lng: round2(Number(me.location.longitude)) });

                // nearby_donors() returns only donors within the radius of that
                // location: masked name, blood group, a coarse area code, a
                // location rounded to ~1 km and a distance in whole km.
                const { data, error } = await supabase.rpc('nearby_donors');
                if (error) throw error;
                if (cancelled) return;
                setDonors(((data || []) as NearbyRow[]).flatMap((d): Donor[] => {
                    if (!hasUsableLocation(d.approx_location)) return [];
                    return [{
                        id: d.id,
                        display_name: d.display_name || 'Donor',
                        blood_group: d.blood_group,
                        area_code: d.area_code ?? null,
                        location: { latitude: Number(d.approx_location.latitude), longitude: Number(d.approx_location.longitude) },
                        distance_km: Math.max(1, Math.round(Number(d.distance_km) || 1)),
                    }];
                }));
            } catch (err) {
                console.error('Error fetching donors', err);
                if (!cancelled) setLoadError('We couldn’t load donors. Please refresh the page to try again.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [userId]);

    if (loading) {
        return <NearbyDonorsSkeleton />;
    }

    const header = (
        <header>
            <h1 className="display text-4xl sm:text-[2.75rem]">Donors near you</h1>
            <p className="mt-3 max-w-lg text-gray-600">
                Registered donors within about {MATCH_RADIUS_KM} km of the location saved in your profile. Names are shortened, locations are rounded to about a kilometre, and only the first three digits of a PIN code are shown. Contact details are never shown here.
            </p>
        </header>
    );

    if (!centre) {
        return (
            <div className="space-y-6">
                {header}
                {loadError ? (
                    <Alert variant="error">{loadError}</Alert>
                ) : (
                    <div className="rounded-lg border border-gray-200 bg-white px-6 py-12 text-center">
                        <MapPin className="mx-auto h-5 w-5 text-gray-500" strokeWidth={1.75} />
                        <p className="mt-3 text-sm font-medium text-gray-900">Set your location to see donors near you</p>
                        <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">
                            We show donors within {MATCH_RADIUS_KM} km of you, so we need to know roughly where you are. Add your current PIN code in Settings and we’ll place you on the map.
                        </p>
                        <Link
                            href="/profile/edit#location"
                            className="mt-5 inline-flex h-10 items-center rounded-md bg-gray-900 px-4 text-sm font-medium text-white transition-colors hover:bg-gray-800"
                        >
                            Go to Settings
                        </Link>
                    </div>
                )}
            </div>
        );
    }

    const mapCentre = focus ?? centre;

    return (
        <div className="space-y-6">
            {header}

            <div className="space-y-3">
                <p className="flex items-center gap-2 text-sm text-gray-700">
                    <MapPin className="h-4 w-4 shrink-0 text-gray-500" strokeWidth={1.75} />
                    <span>
                        Showing donors within {MATCH_RADIUS_KM} km of your saved location.{' '}
                        <Link href="/profile/edit#location" className="text-gray-900 underline underline-offset-4">Change it in Settings</Link>
                    </span>
                </p>
                {loadError && <Alert variant="error">{loadError}</Alert>}
            </div>

            <div className="grid overflow-hidden rounded-lg border border-gray-200 bg-white lg:h-[calc(100vh-17rem)] lg:min-h-[480px] lg:grid-cols-[1fr_340px]">
                <div className="relative z-0 h-[300px] border-b border-gray-200 lg:h-full lg:border-b-0 lg:border-r">
                    <Map
                        center={mapCentre}
                        zoom={10}
                        markers={[
                            { position: centre, title: 'Your saved location' },
                            ...donors.map(d => ({
                                position: { lat: d.location.latitude, lng: d.location.longitude },
                                title: `${d.display_name} · ${formatBloodGroup(d.blood_group)}`,
                                description: `About ${d.distance_km} km away`
                            }))
                        ]}
                    />
                </div>

                <div className="flex min-h-0 flex-col">
                    <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
                        <span className="text-sm font-medium text-gray-900">Within {MATCH_RADIUS_KM} km</span>
                        <span className="text-sm tabular-nums text-gray-500">{donors.length} shown</span>
                    </div>
                    <ul className="max-h-[420px] flex-1 divide-y divide-gray-200 overflow-y-auto lg:max-h-none">
                        {donors.length === 0 ? (
                            <li className="px-5 py-12 text-center">
                                <MapPin className="mx-auto h-5 w-5 text-gray-500" strokeWidth={1.75} />
                                <p className="mt-3 text-sm font-medium text-gray-900">
                                    {loadError ? 'Donors couldn’t be loaded' : `No donors within ${MATCH_RADIUS_KM} km yet`}
                                </p>
                                <p className="mt-1 text-sm text-gray-500">
                                    {loadError
                                        ? 'Refresh the page to try again.'
                                        : 'Donors appear here once they join and add a location near you. Sharing Vital helps.'}
                                </p>
                            </li>
                        ) : donors.map(donor => (
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
                                    <span className="shrink-0 text-sm tabular-nums text-gray-600">about {donor.distance_km} km</span>
                                </button>
                            </li>
                        ))}
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
