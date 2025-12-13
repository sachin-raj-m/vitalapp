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
    selectedPosition?: Location | null;
    onLocationSelect?: (location: Location) => void;
    interactive?: boolean;
}

function LocationMarker({
    onLocationSelect,
    selectedPosition
}: {
    onLocationSelect?: (loc: Location) => void;
    selectedPosition?: Location | null;
}) {
    const [position, setPosition] = useState<Location | null>(selectedPosition || null);

    const map = useMapEvents({
        click(e) {
            const newPos = { lat: e.latlng.lat, lng: e.latlng.lng };
            // If not controlled, update local state
            if (!selectedPosition) {
                setPosition(newPos);
            }
            if (onLocationSelect) {
                onLocationSelect(newPos);
            }
        },
    });

    useEffect(() => {
        if (selectedPosition) {
            setPosition(selectedPosition);
            map.flyTo([selectedPosition.lat, selectedPosition.lng], map.getZoom());
        }
    }, [selectedPosition, map]);

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
    selectedPosition,
    onLocationSelect,
    interactive = false
}: MapProps) {
    return (
        <MapContainer
            center={selectedPosition ? [selectedPosition.lat, selectedPosition.lng] : [center.lat, center.lng]}
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

            {interactive && <LocationMarker onLocationSelect={onLocationSelect} selectedPosition={selectedPosition} />}
        </MapContainer>
    );
}
