"use client";

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icon missing
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface Location {
    lat: number;
    lng: number;
}

interface MapProps {
    center?: Location;
    zoom?: number;
    markers?: Array<{
        position: Location;
        title?: string;
        description?: string;
    }>;
    onLocationSelect?: (location: Location) => void;
    interactive?: boolean;
}

function LocationMarker({ onLocationSelect }: { onLocationSelect?: (loc: Location) => void }) {
    const [position, setPosition] = useState<Location | null>(null);
    const map = useMapEvents({
        click(e) {
            setPosition(e.latlng);
            if (onLocationSelect) {
                onLocationSelect(e.latlng);
            }
        },
    });

    return position === null ? null : (
        <Marker position={position}>
            <Popup>Selected Location</Popup>
        </Marker>
    );
}

export default function Map({
    center = { lat: 20.5937, lng: 78.9629 }, // Default to India
    zoom = 5,
    markers = [],
    onLocationSelect,
    interactive = false
}: MapProps) {
    return (
        <MapContainer
            center={[center.lat, center.lng]}
            zoom={zoom}
            scrollWheelZoom={true}
            style={{ height: '100%', width: '100%', minHeight: '400px', borderRadius: '0.5rem' }}
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {markers.map((marker, idx) => (
                <Marker key={idx} position={[marker.position.lat, marker.position.lng]}>
                    {(marker.title || marker.description) && (
                        <Popup>
                            <div className="font-semibold">{marker.title}</div>
                            <div className="text-sm">{marker.description}</div>
                        </Popup>
                    )}
                </Marker>
            ))}

            {interactive && <LocationMarker onLocationSelect={onLocationSelect} />}
        </MapContainer>
    );
}
