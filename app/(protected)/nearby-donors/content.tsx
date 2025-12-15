"use client";

import React, { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { MapPin, Phone, User, Navigation } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';

const Map = dynamic(() => import('@/components/Map'), {
    ssr: false,
    loading: () => <div className="h-[500px] w-full bg-gray-100 animate-pulse rounded-lg" />
});

interface Donor {
    id: string;
    full_name: string;
    blood_group: string;
    phone: string;
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
                    .select('id, full_name, blood_group, phone, location, present_zip')
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
                for (const zip of Array.from(zipsToGeocode)) {
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
                            // Small delay to respect rate limit (1 req/sec recommended for OSM)
                            await new Promise(r => setTimeout(r, 1000));
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
                        console.log(`Assigning location for ${d.full_name} from zip ${d.present_zip}`);
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

                console.log('Processed Donors:', donosWithLocation);
                setDonors(donosWithLocation as Donor[]);
            } catch (err: any) {
                console.error("Error fetching donors", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchDonors();
    }, []); // We keep dependency array empty to run once, but logically we might want to re-run if zipCache changes? 
    // Actually, we update state *inside* the effect, so we shouldn't depend on it to avoid loops. 
    // Correct approach: define fetchDonors outside or keep it self-contained. 
    // Here I kept it contained but utilizing the closure's state isn't great. 
    // To fix: I'll actually just use the local 'newZipCache' for the immediate render.

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
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Nearby Donors</h1>
                    <p className="text-gray-600">Find registered donors in your area</p>
                </div>
                <Button
                    onClick={getUserLocation}
                    leftIcon={<Navigation className="h-4 w-4" />}
                    disabled={!!status}
                >
                    {status || "Use My Location"}
                </Button>
            </div>

            {error && <Alert variant="error">{error}</Alert>}

            <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 h-[500px] border border-gray-200 rounded-xl overflow-hidden shadow-sm">
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

                <div className="lg:col-span-1 space-y-4 h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                    <h2 className="font-semibold text-gray-700 bg-gray-50 p-2 rounded">
                        Closest Donors ({nearbyDonors.length})
                    </h2>

                    {nearbyDonors.length === 0 ? (
                        <p className="text-gray-500 text-center py-8">
                            No donors found nearby. Try expanding your search or waiting for donors to load.
                        </p>
                    ) : (
                        nearbyDonors.map(donor => (
                            <Card key={donor.id} className="hover:shadow-md transition-shadow">
                                <CardBody className="p-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="font-bold text-gray-900 flex items-center">
                                                {donor.full_name}
                                            </h3>
                                            <span className="inline-block bg-primary-100 text-primary-800 text-xs px-2 py-0.5 rounded-full font-bold mt-1">
                                                {donor.blood_group}
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-medium text-gray-900">
                                                {donor.distanceKm?.toFixed(1)} km
                                            </p>
                                            <p className="text-xs text-gray-500">away</p>
                                        </div>
                                    </div>

                                    <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
                                        {donor.phone ? (
                                            <a
                                                href={`tel:${donor.phone}`}
                                                className="text-sm text-secondary-600 hover:text-secondary-700 flex items-center font-medium"
                                            >
                                                <Phone className="h-3 w-3 mr-1" />
                                                Call Now
                                            </a>
                                        ) : (
                                            <span className="text-xs text-gray-400 italic">No phone shared</span>
                                        )}

                                        <div className="flex items-center text-xs text-gray-500">
                                            <MapPin className="h-3 w-3 mr-1" />
                                            {donor.location.address?.split(',')[0] || "Unknown Location"}
                                        </div>
                                    </div>
                                </CardBody>
                            </Card>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
