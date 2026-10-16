"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { usableLocation } from '@/lib/location';

const DISMISS_KEY = 'vital:location-nudge-dismissed';

/**
 * Shown to donors with no usable location (none stored, or the old (0,0)
 * placeholder): without one they're only matched by district, not by distance.
 * Dismissing hides it for this browser session only.
 */
export function LocationNudge({ className = '' }: { className?: string }) {
    const { user } = useAuth();
    const [dismissed, setDismissed] = useState(() => {
        try { return typeof window !== 'undefined' && sessionStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
    });

    if (!user?.is_donor || dismissed || usableLocation(user.location)) return null;

    const dismiss = () => {
        setDismissed(true);
        try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* storage unavailable; hidden until reload */ }
    };

    return (
        <section aria-labelledby="location-nudge-title" className={`flex flex-col gap-3 rounded-xl border border-warning-200 bg-warning-50 p-5 sm:flex-row sm:items-center ${className}`}>
            <MapPin className="hidden h-5 w-5 shrink-0 text-warning-800 sm:block" aria-hidden />
            <div className="flex-1">
                <h2 id="location-nudge-title" className="font-medium text-gray-900">Add your location to get alerts near you</h2>
                <p className="mt-1 text-sm leading-relaxed text-gray-700">
                    We don’t know where you are yet, so you’re only matched by district and may miss requests from hospitals close by.
                    It takes one tap, and no one else sees it exactly.
                </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
                <Link href="/profile/edit#alert-location" className="inline-flex h-9 items-center rounded-md bg-gray-900 px-4 text-sm font-medium text-white hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2">
                    Set my location
                </Link>
                <button type="button" onClick={dismiss} className="text-sm text-gray-700 underline underline-offset-4 hover:text-gray-900">
                    Not now
                </button>
            </div>
        </section>
    );
}
