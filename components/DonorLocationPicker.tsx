"use client";

import React, { useId, useState } from 'react';
import dynamic from 'next/dynamic';
import { Crosshair, Map as MapIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { authedFetch } from '@/lib/api';
import {
    describeAccuracy, describeSource, getDevicePosition, insideIndia, isPrecise, usableLocation,
    MAX_GPS_ACCURACY_M, type StoredLocation,
} from '@/lib/location';

const Map = dynamic(() => import('@/components/Map'), {
    ssr: false,
    loading: () => <div className="h-full w-full animate-pulse bg-gray-100" />,
});

/** A point the donor chose, not yet saved. */
export interface PickedPoint {
    latitude: number;
    longitude: number;
    source: 'gps' | 'manual';
    accuracy?: number;
}

interface Props {
    /** The stored profiles.location (any shape; placeholders count as none). */
    value?: unknown;
    /**
     * 'save' (Settings): saves through /api/profile/location and calls onSaved.
     * 'defer' (registration): reports the chosen point through onPick; the
     * page saves it after the profile exists.
     */
    mode: 'save' | 'defer';
    onSaved?: (location: StoredLocation | null) => void;
    onPick?: (point: PickedPoint | null) => void;
}

const INDIA = { lat: 20.5937, lng: 78.9629 };

/**
 * "Where should we alert you from?" Device location (asked for only when the
 * donor taps), a point placed on the map, or the PIN code centre as fallback.
 */
export function DonorLocationPicker({ value, mode, onSaved, onPick }: Props) {
    const explainId = useId();
    const statusId = useId();
    const stored = usableLocation(value);
    const [draft, setDraft] = useState<PickedPoint | null>(null);
    const [mapOpen, setMapOpen] = useState(false);
    const [busy, setBusy] = useState<'gps' | 'save' | 'pin' | null>(null);
    const [message, setMessage] = useState<{ tone: 'error' | 'ok'; text: string } | null>(null);

    const changeDraft = (point: PickedPoint | null) => {
        setDraft(point);
        if (mode === 'defer') onPick?.(point);
    };

    const useDevice = async () => {
        setMessage(null);
        setBusy('gps');
        try {
            const pos = await getDevicePosition();
            if (!insideIndia(pos.latitude, pos.longitude)) {
                setMessage({ tone: 'error', text: 'Your device reports a position outside India. Place yourself on the map instead.' });
                return;
            }
            if (pos.accuracy > MAX_GPS_ACCURACY_M) {
                setMessage({ tone: 'error', text: `Your device only knows roughly where you are (${describeAccuracy(pos.accuracy)}). Tap the map to place yourself instead.` });
                setMapOpen(true);
                return;
            }
            changeDraft({ latitude: pos.latitude, longitude: pos.longitude, source: 'gps', accuracy: pos.accuracy });
            setMapOpen(true);
            setMessage({
                tone: 'ok',
                text: mode === 'defer'
                    ? `Got it (${describeAccuracy(pos.accuracy)}). Check the pin below; tap the map to move it.`
                    : `Found you (${describeAccuracy(pos.accuracy)}). Check the pin, then save.`,
            });
        } catch (err) {
            setMessage({ tone: 'error', text: err instanceof Error ? err.message : 'Couldn’t get your location.' });
        } finally {
            setBusy(null);
        }
    };

    const post = async (body: Record<string, unknown>, kind: 'save' | 'pin') => {
        setMessage(null);
        setBusy(kind);
        try {
            let res: Response;
            try {
                // The server gives up on the map services after ~20 s; don't hang longer than it.
                res = await authedFetch('/api/profile/location', { method: 'POST', body: JSON.stringify(body), signal: AbortSignal.timeout(35000) });
            } catch (err) {
                throw new Error(err instanceof Error && err.name === 'TimeoutError'
                    ? 'This is taking too long. Try again in a minute, or place yourself on the map instead.'
                    : 'Couldn’t reach Vital. Check your internet connection and try again.');
            }
            const data = await res.json().catch(() => null);
            if (res.status === 429) throw new Error('Too many changes. Please wait a minute and try again.');
            if (res.status === 504) throw new Error('The map service took too long. Try again in a minute, or place yourself on the map instead.');
            if (!res.ok) throw new Error(data?.error || 'Could not save your location. Please try again.');
            if (data?.reason === 'no_pin') {
                // Nothing changed on the server.
                setMessage({ tone: 'error', text: 'Add your PIN code to your profile and save it first.' });
                return;
            }
            const saved = usableLocation(data?.location);
            setDraft(null);
            setMapOpen(false);
            if (kind === 'pin' && !saved) {
                setMessage({ tone: 'error', text: 'We couldn’t find your PIN code on the map. Place yourself on the map instead.' });
            } else if (kind === 'pin' && data?.reason === 'pin_not_found') {
                setMessage({ tone: 'ok', text: `We couldn’t find your PIN code on the map, so we placed you at the centre of ${saved?.label || 'your district'}.` });
            } else {
                setMessage({ tone: 'ok', text: kind === 'pin' && saved?.label ? `Location saved: ${saved.label}.` : 'Location saved.' });
            }
            onSaved?.(saved);
        } catch (err) {
            setMessage({ tone: 'error', text: err instanceof Error ? err.message : 'Could not save your location.' });
        } finally {
            setBusy(null);
        }
    };

    const shown = draft
        ? { lat: draft.latitude, lng: draft.longitude }
        : stored ? { lat: stored.latitude, lng: stored.longitude } : null;

    let status: React.ReactNode;
    if (draft) {
        status = mode === 'defer'
            ? <>Location chosen {draft.source === 'gps' ? 'from your device' : 'on the map'}{draft.accuracy ? ` (${describeAccuracy(draft.accuracy)})` : ''}. It’s saved with your profile.</>
            : <>Not saved yet: check the pin and tap <strong>Save this location</strong>.</>;
    } else if (stored) {
        const accuracy = describeAccuracy(stored.accuracy_m);
        status = (
            <>
                <span className="text-gray-900">Near {stored.label || `${stored.latitude.toFixed(3)}, ${stored.longitude.toFixed(3)}`}</span>
                {' '}({describeSource(stored.source)}{accuracy ? `, ${accuracy}` : ''}).
                {!isPrecise(stored) && ' Set your exact location for alerts from the closest hospitals.'}
            </>
        );
    } else {
        status = mode === 'defer'
            ? 'Optional. If you skip this, we place you at the centre of your PIN code area.'
            : <span className="text-warning-800">No location yet, so you’re only matched by district. Add one to get alerts from hospitals near you.</span>;
    }

    return (
        <div className="space-y-3">
            <p id={statusId} className="text-sm leading-relaxed text-gray-600" aria-live="polite">{status}</p>
            <p id={explainId} className="text-[13px] leading-relaxed text-gray-500">
                We use this only to alert you when someone near you needs blood. No one else ever sees it exactly:
                other donors and requesters see it rounded to about 1 km. Your browser will ask first, and we read
                your position once, when you tap, never in the background. Use it where you usually are, such as home or work.
            </p>
            <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={useDevice} isLoading={busy === 'gps'} aria-describedby={explainId}>
                    <Crosshair className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Use my current location
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setMapOpen(o => !o)} aria-expanded={mapOpen}>
                    <MapIcon className="mr-1.5 h-3.5 w-3.5" aria-hidden /> {mapOpen ? 'Hide map' : stored || draft ? 'Adjust on the map' : 'Place me on the map'}
                </Button>
                {mode === 'save' && isPrecise(stored) && !draft && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => post({ mode: 'pin', replace: true }, 'pin')} isLoading={busy === 'pin'}>
                        Use my PIN code instead
                    </Button>
                )}
            </div>

            {message && (
                <p role={message.tone === 'error' ? 'alert' : 'status'} className={`text-[13px] ${message.tone === 'error' ? 'text-red-700' : 'text-success-700'}`}>
                    {message.text}
                </p>
            )}

            {mapOpen && (
                <div>
                    <div className="relative z-0 h-[260px] overflow-hidden rounded-md border border-gray-300">
                        <Map
                            interactive
                            pinLabel="Your location"
                            center={shown ?? INDIA}
                            zoom={shown ? 15 : 5}
                            selectedPosition={shown}
                            onLocationSelect={loc => {
                                if (!insideIndia(loc.lat, loc.lng)) {
                                    setMessage({ tone: 'error', text: 'Choose a place in India.' });
                                    return;
                                }
                                setMessage(null);
                                changeDraft({ latitude: loc.lat, longitude: loc.lng, source: 'manual' });
                            }}
                        />
                    </div>
                    <p className="mt-1.5 text-xs text-gray-500">Tap the map to move the pin. Zoom in to place it accurately.</p>
                    {mode === 'save' && draft && (
                        <div className="mt-3 flex flex-wrap gap-2">
                            <Button
                                type="button"
                                variant="ink"
                                size="sm"
                                isLoading={busy === 'save'}
                                onClick={() => post({ mode: 'point', source: draft.source, latitude: draft.latitude, longitude: draft.longitude, accuracy: draft.accuracy }, 'save')}
                            >
                                Save this location
                            </Button>
                            <Button type="button" variant="ghost" size="sm" onClick={() => { setDraft(null); setMapOpen(false); setMessage(null); }}>
                                Cancel
                            </Button>
                        </div>
                    )}
                    {mode === 'defer' && draft && (
                        <button type="button" className="mt-2 text-[13px] text-gray-600 underline underline-offset-4 hover:text-gray-900" onClick={() => { changeDraft(null); setMapOpen(false); setMessage(null); }}>
                            Don’t use this; use my PIN code
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
