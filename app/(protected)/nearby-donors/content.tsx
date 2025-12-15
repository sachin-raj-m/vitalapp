"use client";

import React, { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { MapPin, Navigation, Search } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';

const Map = dynamic(() => import('@/components/Map'), {
    ssr: false,
    loading: () => <div className="h-full w-full bg-gray-100 animate-pulse rounded-xl flex items-center justify-center text-gray-400">Loading Map...</div>
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

const getInitials = (name: string) => {
    return name
        .split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
};

const getBloodGroupColor = (bg: string) => {
    if (bg.includes('+')) return 'bg-rose-100 text-rose-700 border-rose-200';
    return 'bg-indigo-100 text-indigo-700 border-indigo-200';
};

export default function NearbyDonorsPageContent() {
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
                const { data, error } = await supabase
                    .from('profiles')
                    .select('id, full_name, blood_group, location, present_zip')
                    .eq('is_donor', true);

                if (error) throw error;

                // Parse location jsonb and initial processing
                let parsedDonors = data?.map(d => ({
                    ...d,
                    location: typeof d.location === 'string' ? JSON.parse(d.location) : d.location
                })) || [];

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
                        const response = await fetch(`https://nominatim.openstreetmap.org/search?postalcode=${zip}&country=India&format=json&limit=1`, {
                            headers: {
                                'User-Agent': 'VitalBloodApp/1.0'
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

    // Calculate distances when center or donors change
    useEffect(() => {
        // Filter out donors with invalid location
        const validDonors = donors.filter(d =>
            d.location &&
            d.location.latitude !== undefined && d.location.latitude !== null &&
            d.location.longitude !== undefined && d.location.longitude !== null
        );

        const withDistance = validDonors.map(d => {
            const dist = haversineDistanceKm(center.lat, center.lng, d.location.latitude, d.location.longitude);
            return { ...d, distanceKm: dist };
        });

        // Sort by distance and take top 20
        const sorted = withDistance.sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));
        setNearbyDonors(sorted.slice(0, 20));

    }, [center, donors]);

    return (
        <div className="space-y-6 h-[calc(100vh-140px)] flex flex-col">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 flex-shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Find Donors Nearby</h1>
                    <p className="text-gray-500 text-sm">Discover life-savers in your vicinity</p>
                </div>
                <Button
                    onClick={getUserLocation}
                    leftIcon={status ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> : <Navigation className="h-4 w-4" />}
                    disabled={!!status}
                    className="shadow-sm transition-all hover:shadow-md active:scale-95"
                >
                    {status || "Use My Location"}
                </Button>
            </div>

            {error && <Alert variant="error" className="flex-shrink-0">{error}</Alert>}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-grow min-h-0">
                {/* Map Section */}
                <div className="lg:col-span-8 h-[400px] lg:h-full rounded-2xl overflow-hidden border border-gray-200 shadow-sm relative group bg-gray-50">
                    <Map
                        center={center}
                        zoom={11}
                        markers={[
                            { position: center, title: "You are here" },
                            ...nearbyDonors.map(d => ({
                                position: { lat: d.location.latitude, lng: d.location.longitude },
                                title: d.full_name,
                                description: `${d.blood_group} | ${d.distanceKm?.toFixed(1)} km away`
                            }))
                        ]}
                    />
                </div>

                {/* List Section */}
                <div className="lg:col-span-4 flex flex-col h-full min-h-0 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                        <h2 className="font-semibold text-gray-800 flex items-center">
                            <Search className="w-4 h-4 mr-2 text-gray-400" />
                            Closest Donors
                        </h2>
                        <span className="bg-white text-gray-600 px-2 py-0.5 rounded-full text-xs font-medium border border-gray-200">
                            {nearbyDonors.length} found
                        </span>
                    </div>

                    <div className="overflow-y-auto p-4 space-y-3 custom-scrollbar flex-grow">
                        {nearbyDonors.length === 0 ? (
                            <div className="text-center py-12 flex flex-col items-center justify-center opacity-60">
                                <div className="bg-gray-100 p-4 rounded-full mb-3">
                                    <MapPin className="h-8 w-8 text-gray-400" />
                                </div>
                                <p className="text-gray-900 font-medium">No donors found nearby</p>
                                <p className="text-sm text-gray-500 mt-1 max-w-[200px]">
                                    Try using your current location or expanding your search area.
                                </p>
                            </div>
                        ) : (
                            nearbyDonors.map(donor => (
                                <div
                                    key={donor.id}
                                    className="group flex items-center p-3 rounded-xl border border-gray-100 hover:border-primary-100 hover:bg-primary-50/30 transition-all duration-200 cursor-default"
                                >
                                    {/* Avatar */}
                                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-gray-500 font-bold text-lg shadow-inner flex-shrink-0">
                                        {getInitials(donor.full_name)}
                                    </div>

                                    {/* Content */}
                                    <div className="ml-3 flex-grow min-w-0">
                                        <div className="flex justify-between items-start">
                                            <h3 className="font-semibold text-gray-900 truncate pr-2">
                                                {donor.full_name}
                                            </h3>
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded border ${getBloodGroupColor(donor.blood_group)}`}>
                                                {donor.blood_group}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between mt-1">
                                            <div className="flex items-center text-xs text-gray-500">
                                                {donor.present_zip ? (
                                                    <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 font-mono">
                                                        {donor.present_zip}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400 italic">Zip N/A</span>
                                                )}
                                            </div>
                                            <div className="text-xs font-medium text-gray-500 flex items-center">
                                                <MapPin className="w-3 h-3 mr-1 text-gray-400" />
                                                {donor.distanceKm?.toFixed(1)} km
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
