import React, { useCallback, useEffect, useState } from "react";
import { GoogleMap, Marker, InfoWindow, useLoadScript } from "@react-google-maps/api";
import { supabase } from "../../lib/supabase";

type Donor = {
  id: string;
  full_name?: string | null;
  blood_group?: string | null;
  phone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  location?: { latitude?: number | null; longitude?: number | null } | null;
  distanceKm?: number;
};

const mapContainerStyle = {
  width: "100%",
  height: "600px",
};

const libraries: ("places")[] = ["places"];

function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function DonorMap({ radiusKm = 10 }: { radiusKm?: number }) {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries,
  });

  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [donors, setDonors] = useState<Donor[]>([]);
  const [nearby, setNearby] = useState<Donor[]>([]);
  const [selected, setSelected] = useState<Donor | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const getUserLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setError("Geolocation not supported by your browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => setError("Unable to get your location: " + err.message),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchDonors = async () => {
      setLoading(true);
      setError("");
      try {
        const { data, error } = await supabase
          .from("donors") // change to "profiles" if needed
          .select("id, full_name, blood_group, phone, latitude, longitude, location");

        if (error) throw error;
        if (!cancelled) setDonors((data as Donor[]) || []);
      } catch (err: any) {
        setError(err.message || "Failed to fetch donors.");
      } finally {
        setLoading(false);
      }
    };

    fetchDonors();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!center) return;

    const list = donors
      .map((d) => {
        const lat = d.latitude ?? d.location?.latitude ?? null;
        const lng = d.longitude ?? d.location?.longitude ?? null;
        if (lat == null || lng == null) return null;

        const dist = haversineDistanceKm(center.lat, center.lng, lat, lng);
        return { ...d, distanceKm: dist } as Donor;
      })
      .filter(Boolean)
      .filter((d) => (d?.distanceKm ?? Infinity) <= radiusKm)
      .sort((a, b) => (a!.distanceKm! - b!.distanceKm!));

    setNearby(list as Donor[]);
  }, [center, donors, radiusKm]);

  if (loadError) return <div className="text-red-500">Map failed to load</div>;
  if (!isLoaded) return <div>Loading Google Maps...</div>;

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <button
          onClick={getUserLocation}
          className="px-3 py-2 bg-blue-600 text-white rounded"
        >
          Use My Location
        </button>

        <div className="ml-auto">
          {loading ? "Loading donors..." : `${nearby.length} donors nearby`}
        </div>
      </div>

      {error && <div className="mb-3 text-red-500">{error}</div>}

      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center ?? { lat: 20.5937, lng: 78.9629 }} // India center
        zoom={13}
      >
        {center && (
          <Marker
            position={center}
            icon={{
              url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
            }}
          />
        )}

        {nearby.map((d) => {
          const lat = d.latitude ?? d.location?.latitude;
          const lng = d.longitude ?? d.location?.longitude;
          if (!lat || !lng) return null;
          return (
            <Marker
              key={d.id}
              position={{ lat, lng }}
              onClick={() => setSelected(d)}
            />
          );
        })}

        {selected && (() => {
          const lat = selected.latitude ?? selected.location?.latitude;
          const lng = selected.longitude ?? selected.location?.longitude;
          if (!lat || !lng) return null;

          return (
            <InfoWindow position={{ lat, lng }} onCloseClick={() => setSelected(null)}>
              <div>
                <h3 className="font-bold">{selected.full_name}</h3>
                <p>Blood group: {selected.blood_group}</p>
                <p>Phone: {selected.phone}</p>
                <p>{selected.distanceKm?.toFixed(1)} km away</p>
              </div>
            </InfoWindow>
          );
        })()}
      </GoogleMap>
    </div>
  );
}
