import React from "react";
import DonorMap from "../components/Map/DonorMap";

export default function NearbyDonorsPage() {
  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Nearby Donors</h1>
      <DonorMap radiusKm={10} />
    </div>
  );
}
