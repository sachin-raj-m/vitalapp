"use client";

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Brand marker: a small drop, red by default, ink for "you are here" style pins.
const dropIcon = (color: string) =>
    L.divIcon({
        className: '',
        iconSize: [22, 30],
        iconAnchor: [11, 29],
        popupAnchor: [0, -26],
        html: `<svg width="22" height="30" viewBox="0 0 10 14" xmlns="http://www.w3.org/2000/svg"><path d="M5 0C5 0 0 6.2 0 9a5 5 0 0 0 10 0C10 6.2 5 0 5 0Z" fill="${color}" stroke="#FAF8F5" stroke-width="0.8"/></svg>`,
    });
const RED_DROP = dropIcon('#B5161B');
const INK_DROP = dropIcon('#1B1815');

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

    const selLat = selectedPosition?.lat;
    const selLng = selectedPosition?.lng;
    useEffect(() => {
        if (selLat === undefined || selLng === undefined) return;
        setPosition({ lat: selLat, lng: selLng });
        map.flyTo([selLat, selLng], Math.max(map.getZoom(), 13));
    }, [selLat, selLng, map]);

    return position === null ? null : (
        <Marker position={position} icon={INK_DROP}>
            <Popup>Hospital location</Popup>
        </Marker>
    );
}

// Component to handle map center updates
// Depends on the coordinates, not the object, so re-renders with an
// equal-but-new center don't re-fly the map and undo the user's panning.
function MapUpdater({ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) {
    const map = useMapEvents({});
    useEffect(() => {
        map.flyTo([lat, lng], zoom, { animate: true, duration: 1.2 });
    }, [lat, lng, zoom, map]);
    return null;
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
            center={[center.lat, center.lng]}
            zoom={zoom}
            scrollWheelZoom={true}
            style={{ height: '100%', width: '100%', minHeight: '240px', background: '#F3F0EB' }}
        >
            {/* Keyless OSM tiles, desaturated in CSS (.vital-tiles) to sit quietly in the design. */}
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                className="vital-tiles"
                maxZoom={19}
            />

            <MapUpdater lat={center.lat} lng={center.lng} zoom={zoom} />

            {markers.map((marker, idx) => (
                <Marker
                    key={`${marker.position.lat}-${marker.position.lng}-${idx}`}
                    position={[marker.position.lat, marker.position.lng]}
                    icon={marker.title === 'You are here' ? INK_DROP : RED_DROP}
                >
                    {(marker.title || marker.description) && (
                        <Popup>
                            <div className="font-sans text-sm font-medium text-gray-900">{marker.title}</div>
                            {marker.description && <div className="font-sans text-xs text-gray-600">{marker.description}</div>}
                        </Popup>
                    )}
                </Marker>
            ))}

            {interactive && <LocationMarker onLocationSelect={onLocationSelect} selectedPosition={selectedPosition} />}
        </MapContainer>
    );
}
