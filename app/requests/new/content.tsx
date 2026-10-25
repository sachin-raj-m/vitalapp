"use client";

import { authedFetch } from '@/lib/api';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { BLOOD_GROUPS, formatBloodGroup } from '@/lib/blood-compatibility';
import { Input, Textarea } from '@/components/ui/Input';
import { DatePicker, addDaysYmd } from '@/components/ui/DatePicker';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import type { BloodGroup, UrgencyLevel } from '@/types';
import dynamic from 'next/dynamic';
import { logActivity } from '@/lib/logger';
import { toast } from 'sonner';
import { consentStamp, earliestConsentAt, hasRecordedConsent, type ConsentFields } from '@/lib/legal';
import { isPhoneTakenError, waNumber } from '@/lib/phone';
import { MATCH_RADIUS_KM } from '@/lib/geo';
import { describeAccuracy, getDevicePosition, insideIndia } from '@/lib/location';
import { QuickVerify } from '@/components/auth/QuickVerify';
import type { User } from '@supabase/supabase-js';
import { PHONE_SIGNIN } from '@/lib/features';

/** A place from /api/geocode (server-side Photon or Nominatim). */
interface GeoPlace {
    latitude: number;
    longitude: number;
    name?: string | null;
    label: string;
    displayName: string;
    city: string | null;
    district: string | null;
    zipcode: string | null;
}

type PinSource = 'search' | 'map' | 'gps';
/** Suggestions while typing the hospital's name. */
type SuggestStatus = 'idle' | 'loading' | 'done' | 'error' | 'limited';

// "Ernakulam" vs "ernakulam district", "Kochi" vs "Kochi City": same place.
const sameName = (a: string, b: string) => {
    const n = (v: string) => v.toLowerCase().replace(/[^a-z]/g, '');
    const x = n(a), y = n(b);
    return !!x && !!y && (x.includes(y) || y.includes(x));
};
const round5 = (n: number) => Math.round(n * 1e5) / 1e5;
/** Using the phone's position for the hospital only makes sense if it's this close. */
const MAX_REQUEST_GPS_ACCURACY_M = 1000;
/** Today's date in India (yyyy-MM-dd), whatever the device's time zone; the database uses the same. */
const today = () => {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const part = (type: string) => parts.find(p => p.type === type)?.value ?? '';
    return `${part('year')}-${part('month')}-${part('day')}`;
};
const dayNumber = (ymd: string) => Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10))) / 86_400_000;
const PAST_DATE = 'Past dates can’t be chosen. A request needs blood today or later.';

/** No separate question: needed today or tomorrow is urgent, within 3 days soon. */
const urgencyFor = (dateNeeded: string): UrgencyLevel => {
    const days = dayNumber(dateNeeded) - dayNumber(today());
    return days <= 1 ? 'High' : days <= 3 ? 'Medium' : 'Low';
};

const Map = dynamic(() => import('@/components/Map'), {
    ssr: false,
    loading: () => (
        <div className="h-full w-full animate-pulse bg-gray-100" />
    )
});

const linkClass = 'text-gray-900 underline decoration-gray-300 underline-offset-4';

/**
 * Requesting blood. No account needed: the person fills in what a donor needs
 * (blood group, units, hospital, needed by, contact), ticks one consent box
 * and verifies once (email code, or WhatsApp when switched on). That signs
 * them in as a requester; they are never sent through the donor form.
 */
export default function CreateRequestPage() {
    const router = useRouter();
    const { user, loading } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        bloodGroup: '' as BloodGroup,
        // The field's text, so it can be cleared and retyped; parsed once on submit.
        unitsNeeded: '1',
        dateNeeded: today(),
        hospitalName: '',
        hospitalAddress: '',
        notes: '',
        contactName: '',
        contactPhone: '',
        whatsappUpdates: true,
        location: {
            latitude: 0,
            longitude: 0,
            address: '',
            source: '' as PinSource | '',
            accuracy_m: null as number | null,
        },
        city: '',
        zipcode: ''
    });

    // The hospital pin: where it came from and what's there.
    const [pinPlace, setPinPlace] = useState<GeoPlace | null>(null);
    const [locating, setLocating] = useState(false);
    const [searching, setSearching] = useState(false);
    const [searchError, setSearchError] = useState('');
    const [addressOpen, setAddressOpen] = useState(false);
    const pinRequest = useRef(0);
    // What the pin last filled in, so picking another place can replace it (but never what was typed).
    const autoFilled = useRef({ address: '', city: '', zipcode: '' });

    // Suggestions as the hospital's name is typed (Photon via /api/geocode).
    const [suggestQuery, setSuggestQuery] = useState<{ q: string; near: string } | null>(null);
    const [suggestions, setSuggestions] = useState<GeoPlace[]>([]);
    const [suggestStatus, setSuggestStatus] = useState<SuggestStatus>('idle');
    const [listOpen, setListOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    // Set when an earlier date was put back to today on leaving the field.
    const [dateReset, setDateReset] = useState(false);
    // Units is checked on leaving the field or posting, never while typing.
    const [unitsChecked, setUnitsChecked] = useState(false);

    const setPin = (latitude: number, longitude: number, source: PinSource, accuracy: number | null = null, known?: GeoPlace) => {
        if (!insideIndia(latitude, longitude)) {
            toast.error('Choose a place in India.');
            return;
        }
        setFormData(prev => ({ ...prev, location: { ...prev.location, latitude, longitude, source, accuracy_m: accuracy } }));
        const fill = (place: GeoPlace) => {
            setPinPlace(place);
            // Fill empty fields from the pin (or ones the last pin filled); never overwrite what the poster typed.
            const last = autoFilled.current;
            setFormData(prev => {
                const next = {
                    address: !prev.hospitalAddress || prev.hospitalAddress === last.address ? place.displayName.split(',').slice(0, 4).join(',').trim() : prev.hospitalAddress,
                    city: !prev.city || prev.city === last.city ? place.city || place.district || '' : prev.city,
                    zipcode: !prev.zipcode || prev.zipcode === last.zipcode ? place.zipcode || '' : prev.zipcode,
                };
                autoFilled.current = next;
                return { ...prev, hospitalAddress: next.address, city: next.city, zipcode: next.zipcode };
            });
        };
        setPinPlace(null);
        if (known) { fill(known); return; }
        const ticket = ++pinRequest.current;
        fetch(`/api/geocode?lat=${latitude.toFixed(5)}&lng=${longitude.toFixed(5)}`)
            .then(res => (res.ok ? res.json() : null))
            .then(body => { if (ticket === pinRequest.current && body?.place) fill(body.place as GeoPlace); })
            .catch(() => { /* the address fields stay editable */ });
    };

    // The fallback when suggestions find nothing or fail: one explicit, wider
    // search (Nominatim, whose policy forbids searching on every keystroke).
    const searchHospital = async () => {
        const q = [formData.hospitalName, formData.city].filter(s => s.trim()).join(', ').trim();
        setSearchError('');
        if (q.length < 3) {
            setSearchError('Type the hospital’s name (and the town if you know it).');
            return;
        }
        setSuggestQuery(null);
        setSearching(true);
        try {
            const res = await fetch(`/api/geocode?search=${encodeURIComponent(q)}`);
            if (res.status === 429) throw new Error('Too many searches. Please wait a minute and try again, or tap the map.');
            if (!res.ok) throw new Error('The map search is unavailable right now. Tap the map to mark the hospital instead.');
            const body = await res.json();
            const results: GeoPlace[] = Array.isArray(body?.results) ? body.results : [];
            setSuggestions(results);
            setSuggestStatus('done');
            setActiveIndex(-1);
            setListOpen(results.length > 0);
            if (results.length === 0) setSearchError('No match found. Try a shorter name or add the town, or tap the map to mark it.');
        } catch (err) {
            setSearchError(err instanceof Error ? err.message : 'Search failed.');
        } finally {
            setSearching(false);
        }
    };

    // Suggestions ~400 ms after the last keystroke; a newer keystroke cancels
    // the wait and aborts a request still in flight.
    useEffect(() => {
        if (!suggestQuery) return;
        const controller = new AbortController();
        const timer = setTimeout(async () => {
            setSuggestStatus('loading');
            try {
                const near = suggestQuery.near ? `&near=${suggestQuery.near}` : '';
                const res = await fetch(`/api/geocode?suggest=${encodeURIComponent(suggestQuery.q)}${near}`, { signal: controller.signal });
                if (res.status === 429) {
                    setSuggestions([]);
                    setSuggestStatus('limited');
                    return;
                }
                if (!res.ok) throw new Error('suggestions failed');
                const body = await res.json();
                const results: GeoPlace[] = Array.isArray(body?.results) ? body.results : [];
                setSuggestions(results);
                setActiveIndex(-1);
                setSuggestStatus('done');
                // Open the list only if they're still in the field.
                setListOpen(document.activeElement?.id === 'hospital-name');
            } catch {
                if (controller.signal.aborted) return;
                setSuggestions([]);
                setSuggestStatus('error');
            }
        }, 400);
        return () => { clearTimeout(timer); controller.abort(); };
    }, [suggestQuery]);

    // Prefill the contact with the signed-in user's details once they load.
    useEffect(() => {
        if (!user) return;
        setFormData(prev => ({
            ...prev,
            contactName: prev.contactName || user.full_name || '',
            contactPhone: prev.contactPhone || user.phone || '',
        }));
    }, [user]);

    // "By continuing you agree…" for everyone who hasn't agreed yet: visitors
    // (a code is only sent after it) and signed-in people without consent on
    // record. Continuing (verifying or posting) is the agreement, recorded with
    // its time and version.
    const agreed = true;
    const [verifiedUserId, setVerifiedUserId] = useState<string | null>(null);
    const userId = user?.id ?? verifiedUserId;

    const [profileConsent, setProfileConsent] = useState<ConsentFields | null | undefined>(undefined);
    useEffect(() => {
        if (!user) return;
        let cancelled = false;
        supabase.from('profiles').select('consent_agreed, consent_at, consent_version').eq('id', user.id).maybeSingle()
            .then(({ data }) => { if (!cancelled) setProfileConsent(data ?? null); });
        return () => { cancelled = true; };
    }, [user]);
    const signedInWithoutConsent = !!user && profileConsent !== undefined && !hasRecordedConsent(profileConsent);
    // Shown until posting, also after a visitor verifies.
    const showConsent = !user || signedInWithoutConsent || !!verifiedUserId;

    if (loading) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
            </div>
        );
    }

    const hasLocation = insideIndia(formData.location.latitude, formData.location.longitude);
    const cityMismatch = !!pinPlace && !!formData.city.trim() && !!(pinPlace.city || pinPlace.district)
        && !sameName(formData.city, pinPlace.city ?? '') && !sameName(formData.city, pinPlace.district ?? '');
    const zipMismatch = !!pinPlace?.zipcode && /^[0-9]{6}$/.test(formData.zipcode.trim()) && pinPlace.zipcode !== formData.zipcode.trim();

    const fail = (message: string, scroll = true) => {
        setError(message);
        if (scroll) window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // 1 to 20 units per request, as the donation and WhatsApp flows allow.
    const unitsProblem = (text: string): string | null => {
        if (!text) return 'Enter how many units are needed.';
        const units = parseInt(text, 10);
        if (units < 1) return 'Units must be at least 1.';
        if (units > 20) return 'Up to 20 units per request. For more, post another request.';
        return null;
    };
    const unitsError = unitsChecked ? unitsProblem(formData.unitsNeeded) : null;

    // What's still missing from the form, if anything (address: under the map).
    const formProblem = (): { message: string; address?: boolean } | null => {
        if (!formData.bloodGroup) return { message: 'Choose the blood group needed.' };
        const units = unitsProblem(formData.unitsNeeded);
        if (units) return { message: units };
        if (!formData.hospitalName.trim()) return { message: 'Enter the hospital’s name.' };
        if (!hasLocation) return { message: 'Mark the hospital on the map (type its name and pick it, or tap the map) so nearby donors are alerted.' };
        if (!formData.city.trim() && !formData.zipcode.trim()) return { message: 'Add the hospital’s town or PIN code (under the map).', address: true };
        if (formData.zipcode.trim() && !/^[1-9][0-9]{5}$/.test(formData.zipcode.trim())) {
            return { message: 'The PIN code should be 6 digits. Fix it or leave it empty.', address: true };
        }
        if (!formData.contactName.trim() || !formData.contactPhone.trim()) return { message: 'Add the contact person’s name and phone number.' };
        // A past date would post an already-expired request that donors can't see.
        if (!formData.dateNeeded || formData.dateNeeded < today()) return { message: PAST_DATE };
        return null;
    };

    const onHospitalChange = (value: string) => {
        setFormData(prev => ({ ...prev, hospitalName: value }));
        setSearchError('');
        const q = value.trim();
        if (q.length < 3) {
            setSuggestQuery(null);
            setSuggestions([]);
            setSuggestStatus('idle');
            setListOpen(false);
            return;
        }
        // Nearer places first once a pin is down (rounded to ~10 km).
        const near = hasLocation ? `${formData.location.latitude.toFixed(1)},${formData.location.longitude.toFixed(1)}` : '';
        setSuggestQuery(prev => (prev?.q === q && prev.near === near ? prev : { q, near }));
    };

    const choosePlace = (place: GeoPlace) => {
        if (place.name) setFormData(prev => ({ ...prev, hospitalName: place.name! }));
        setPin(place.latitude, place.longitude, 'search', null, place);
        setSuggestQuery(null);
        setSuggestions([]);
        setSuggestStatus('idle');
        setListOpen(false);
        setActiveIndex(-1);
        setSearchError('');
    };

    const showList = listOpen && suggestions.length > 0;

    const onHospitalKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        const n = suggestions.length;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            if (!n) return;
            e.preventDefault();
            setListOpen(true);
            setActiveIndex(i => (e.key === 'ArrowDown' ? (i + 1) % n : i <= 0 ? n - 1 : i - 1));
        } else if (e.key === 'Enter') {
            // Never submits the form from here.
            e.preventDefault();
            if (showList && activeIndex >= 0) choosePlace(suggestions[activeIndex]);
            else if (showList && n === 1) choosePlace(suggestions[0]);
            else if (!showList && suggestStatus !== 'loading' && !searching) searchHospital();
        } else if (e.key === 'Escape' && showList) {
            e.preventDefault();
            setListOpen(false);
            setActiveIndex(-1);
        }
    };

    const pastDate = !!formData.dateNeeded && formData.dateNeeded < today();
    // Some mobile browsers ignore min: an earlier date goes back to today on leaving the field.
    const onDateBlur = () => {
        if (pastDate) {
            setFormData(prev => ({ ...prev, dateNeeded: today() }));
            setDateReset(true);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        submit(userId);
    };

    // Verified just now: post straight away when the form is complete, so
    // there's no second button to find. Otherwise they finish it and post.
    const onVerified = (verified: User) => {
        setVerifiedUserId(verified.id);
        if (!formProblem()) submit(verified.id);
        else toast.success('Verified', { description: 'Finish the form above, then post your request.' });
    };

    const submit = async (userId: string | null) => {
        setUnitsChecked(true);
        const problem = formProblem();
        if (problem) {
            if (problem.address) setAddressOpen(true);
            return fail(problem.message);
        }
        if (!userId) {
            setError(PHONE_SIGNIN ? 'Verify your email or WhatsApp below, then post.' : 'Verify your email below, then post.');
            return;
        }

        const unitsNeeded = parseInt(formData.unitsNeeded, 10);
        setIsLoading(true);
        setError('');

        try {
            // Requesters need consent on their profile (enforced in the
            // database), and a name and number so donors know who is asking.
            // Never makes them a donor.
            const { data: existing } = await supabase.from('profiles')
                .select('full_name, phone, consent_agreed, consent_at, consent_version').eq('id', userId).maybeSingle();
            const patch: Record<string, unknown> = {};
            if (!hasRecordedConsent(existing)) {
                const consent = consentStamp();
                Object.assign(patch, consent, { consent_at: earliestConsentAt(existing, consent) ?? consent.consent_at });
            }
            if (!existing?.full_name?.trim()) patch.full_name = formData.contactName.trim();
            const withPhone = !existing?.phone?.trim() && !!waNumber(formData.contactPhone);
            if (withPhone) patch.phone = formData.contactPhone.trim();
            if (Object.keys(patch).length) {
                let { error: profileError } = await supabase.from('profiles').upsert({ id: userId, ...patch }, { onConflict: 'id' });
                if (isPhoneTakenError(profileError) && withPhone) {
                    // Someone else's verified number: post the request without saving it on the profile.
                    delete patch.phone;
                    ({ error: profileError } = await supabase.from('profiles').upsert({ id: userId, ...patch }, { onConflict: 'id' }));
                }
                if (profileError) throw profileError;
                if (patch.consent_agreed) setProfileConsent(consentStamp());
            }

            const address = formData.hospitalAddress.trim() || [formData.hospitalName.trim(), formData.city.trim()].filter(Boolean).join(', ');
            const { data, error: requestError } = await supabase
                .from('blood_requests')
                .insert({
                    user_id: userId,
                    blood_group: formData.bloodGroup,
                    units_needed: unitsNeeded,
                    date_needed: formData.dateNeeded,
                    hospital_name: formData.hospitalName.trim(),
                    hospital_address: address,
                    urgency_level: urgencyFor(formData.dateNeeded),
                    notes: formData.notes,
                    contact_name: formData.contactName.trim(),
                    location: {
                        latitude: round5(formData.location.latitude),
                        longitude: round5(formData.location.longitude),
                        address,
                        source: formData.location.source || 'map',
                        ...(formData.location.accuracy_m ? { accuracy_m: Math.round(formData.location.accuracy_m) } : {}),
                    },
                    city: formData.city.trim(),
                    zipcode: formData.zipcode.trim(),
                    status: 'active'
                })
                .select();

            if (requestError) throw requestError;
            const requestId = data?.[0]?.id;

            // The phone lives in request_contacts so only the requester and
            // donors who offer can read it.
            const { error: contactError } = await supabase
                .from('request_contacts')
                .insert({
                    request_id: requestId,
                    contact_phone: formData.contactPhone.trim(),
                    whatsapp_updates: formData.whatsappUpdates && !!waNumber(formData.contactPhone),
                });
            if (contactError) {
                await supabase.from('blood_requests').delete().eq('id', requestId);
                throw contactError;
            }

            // Alert donors (fire and forget). The server loads the request itself and checks it belongs to us.
            authedFetch('/api/notify/donors', {
                method: 'POST',
                body: JSON.stringify({ requestId })
            }).catch(e => console.error('Notification trigger failed', e));

            await logActivity({
                userId,
                action: 'CREATE_REQUEST',
                entityType: 'blood_requests',
                entityId: requestId,
                metadata: {
                    bloodGroup: formData.bloodGroup,
                    city: formData.city,
                    units: unitsNeeded
                }
            });

            toast.success('Request posted', {
                description: `Compatible donors within ${MATCH_RADIUS_KM} km are being notified. You can share the request to reach more people.`
            });

            router.push(requestId ? `/requests/${requestId}` : '/requests');
        } catch (err: any) {
            setError(err.message || 'Failed to create request');
        } finally {
            setIsLoading(false);
        }
    };

    // Only for someone standing at the hospital: their position becomes the pin.
    const handleGetLocation = async () => {
        setLocating(true);
        try {
            const pos = await getDevicePosition();
            if (!insideIndia(pos.latitude, pos.longitude)) {
                toast.error('Your device reports a position outside India. Search for the hospital or tap the map instead.');
            } else if (pos.accuracy > MAX_REQUEST_GPS_ACCURACY_M) {
                toast.error(`Your device only knows roughly where you are (${describeAccuracy(pos.accuracy)}). Search for the hospital or tap the map instead.`);
            } else {
                setPin(pos.latitude, pos.longitude, 'gps', pos.accuracy);
            }
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Unable to retrieve your location.');
        } finally {
            setLocating(false);
        }
    };

    const section = (title: string, hint: string, children: React.ReactNode) => (
        <section className="grid gap-6 border-t border-gray-200 py-8 md:grid-cols-3 md:gap-10">
            <div>
                <h2 className="font-medium text-gray-900">{title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-gray-500">{hint}</p>
            </div>
            <div className="space-y-4 md:col-span-2">{children}</div>
        </section>
    );

    return (
        <div className="mx-auto max-w-4xl">
            <header className="pb-8">
                <h1 className="display text-4xl sm:text-[2.75rem]">Request blood</h1>
                <p className="mt-3 max-w-xl leading-relaxed text-gray-600">
                    No account needed. Available donors within {MATCH_RADIUS_KM} km of the hospital whose blood group is compatible
                    are alerted, and you get a link to share.
                </p>
            </header>

            {error && <Alert variant="error" className="mb-6" onClose={() => setError('')}>{error}</Alert>}

            {/* Verification sits outside this form (it has forms of its own); the
                Post button below submits it via form="request-form". */}
            <form id="request-form" onSubmit={handleSubmit} noValidate>
                {section('Blood needed', 'The blood group, how many units and by when.', <>
                    <div>
                        <p className="mb-1.5 text-[13px] font-medium text-gray-800">Blood group</p>
                        <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Blood group">
                            {BLOOD_GROUPS.map(g => (
                                <button
                                    key={g}
                                    type="button"
                                    role="radio"
                                    aria-checked={formData.bloodGroup === g}
                                    onClick={() => setFormData({ ...formData, bloodGroup: g })}
                                    className={`h-12 rounded-md border font-serif text-2xl transition-colors ${formData.bloodGroup === g ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 bg-white text-gray-900 hover:border-gray-400'}`}
                                >
                                    {formatBloodGroup(g)}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4">
                        <Input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={2}
                            autoComplete="off"
                            label="Units"
                            value={formData.unitsNeeded}
                            onChange={(e) => {
                                // Digits only (no minus sign), at most 2; empty is allowed while typing.
                                setFormData({ ...formData, unitsNeeded: e.target.value.replace(/\D/g, '').slice(0, 2) });
                                setUnitsChecked(false);
                            }}
                            onBlur={() => setUnitsChecked(true)}
                            error={unitsError ?? undefined}
                            required
                        />
                        <DatePicker
                            id="date-needed"
                            label="Needed by"
                            value={formData.dateNeeded}
                            min={today()}
                            max={addDaysYmd(today(), 90)}
                            today={today()}
                            presets={[
                                { label: 'Today', value: today() },
                                { label: 'Tomorrow', value: addDaysYmd(today(), 1) },
                                { label: 'In 2 days', value: addDaysYmd(today(), 2) },
                            ]}
                            onChange={(value) => {
                                setFormData({ ...formData, dateNeeded: value || today() });
                                setDateReset(false);
                            }}
                            onBlur={onDateBlur}
                            invalid={pastDate}
                            describedBy="date-needed-note date-needed-warning"
                        />
                    </div>
                    <div>
                        <p id="date-needed-note" className="text-[13px] text-gray-500">Requests are for blood needed today or later, so earlier dates can’t be chosen.</p>
                        <div id="date-needed-warning" role="alert" className="text-[13px] text-red-700">
                            {(pastDate || dateReset) && <p className="mt-1">{PAST_DATE}{dateReset && !pastDate ? ' It’s been set to today.' : ''}</p>}
                        </div>
                    </div>
                </>)}

                {section('Hospital', 'Donors near the pin are alerted, so place it on the hospital itself.', <>
                    <div>
                        <div className="relative">
                            <Input
                                id="hospital-name"
                                label="Hospital"
                                value={formData.hospitalName}
                                onChange={(e) => onHospitalChange(e.target.value)}
                                onKeyDown={onHospitalKeyDown}
                                onFocus={() => { if (suggestions.length) setListOpen(true); }}
                                onBlur={() => { setListOpen(false); setActiveIndex(-1); }}
                                required
                                placeholder="e.g. General Hospital, Kochi"
                                autoComplete="off"
                                role="combobox"
                                aria-autocomplete="list"
                                aria-expanded={showList}
                                aria-controls="hospital-suggestions"
                                aria-activedescendant={showList && activeIndex >= 0 ? `hospital-option-${activeIndex}` : undefined}
                                aria-describedby="hospital-search-hint"
                            />
                            <ul
                                id="hospital-suggestions"
                                role="listbox"
                                aria-label="Matching places"
                                hidden={!showList}
                                className="absolute inset-x-0 top-full z-20 mt-1 max-h-80 divide-y divide-gray-200 overflow-y-auto rounded-md border border-gray-300 bg-white shadow-lg"
                            >
                                {showList && suggestions.map((place, i) => (
                                    <li
                                        key={`${place.latitude},${place.longitude},${i}`}
                                        id={`hospital-option-${i}`}
                                        role="option"
                                        aria-selected={i === activeIndex}
                                        // Keeps focus in the field, so the list is still open when the tap lands.
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => choosePlace(place)}
                                        onMouseEnter={() => setActiveIndex(i)}
                                        className={`cursor-pointer px-3 py-2.5 ${i === activeIndex ? 'bg-gray-100' : 'bg-white'}`}
                                    >
                                        <span className="block text-sm font-medium text-gray-900">{place.label}</span>
                                        <span className="block text-xs text-gray-600">{place.displayName}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <p id="hospital-search-hint" className="mt-1.5 text-[13px] text-gray-500" aria-live="polite">
                            {searching ? <span aria-hidden>Searching more widely…</span>
                                : suggestStatus === 'loading' ? <span aria-hidden>Looking for matches…</span>
                                : suggestStatus === 'limited' ? 'Too many searches. Wait a minute, or tap the map to mark the hospital.'
                                : suggestStatus === 'error' ? <>Suggestions aren’t loading right now. <button type="button" onClick={searchHospital} className={linkClass}>Search instead</button>, or tap the map.</>
                                : suggestStatus === 'done' && suggestions.length === 0 && !searchError ? <>No matches yet. Add the town, <button type="button" onClick={searchHospital} className={linkClass}>search more widely</button>, or tap the map.</>
                                : showList ? `${suggestions.length} ${suggestions.length === 1 ? 'match' : 'matches'}. Pick the hospital, or keep typing.`
                                : 'Start typing the name and matching places appear. Or tap the map.'}
                        </p>
                        {searchError && <p role="alert" className="mt-1.5 text-[13px] text-red-700">{searchError}</p>}
                    </div>
                    <div>
                        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                            <p className="text-[13px] font-medium text-gray-800">Hospital on the map</p>
                            <button type="button" onClick={handleGetLocation} disabled={locating} className="inline-flex items-center gap-1 text-[13px] text-gray-600 underline-offset-4 hover:text-gray-900 hover:underline disabled:opacity-60">
                                <MapPin className="h-3.5 w-3.5" aria-hidden /> {locating ? 'Locating…' : 'I’m at the hospital: use my location'}
                            </button>
                        </div>
                        <div className={`relative z-0 h-[260px] overflow-hidden rounded-md border sm:h-[300px] ${hasLocation ? 'border-gray-300' : 'border-dashed border-gray-400'}`}>
                            <Map
                                interactive={true}
                                center={hasLocation ? { lat: formData.location.latitude, lng: formData.location.longitude } : { lat: 20.5937, lng: 78.9629 }}
                                zoom={hasLocation ? 16 : 5}
                                selectedPosition={hasLocation ? { lat: formData.location.latitude, lng: formData.location.longitude } : null}
                                markers={[]}
                                onLocationSelect={(loc) => setPin(loc.lat, loc.lng, 'map')}
                            />
                        </div>
                        <p className="mt-1.5 text-xs text-gray-500" aria-live="polite">
                            {hasLocation
                                ? <>Pin {pinPlace ? <>near <span className="text-gray-800">{pinPlace.label}</span></> : 'placed'}
                                    {formData.location.source === 'gps' && formData.location.accuracy_m ? ` (from your device, ${describeAccuracy(formData.location.accuracy_m)})` : ''}.
                                    {' '}If it’s not on the hospital, zoom in and tap the right spot.</>
                                : 'Pick the hospital from the matches above, or tap the map to mark it.'}
                        </p>
                    </div>
                    {hasLocation && (
                        <details open={addressOpen} onToggle={(e) => setAddressOpen((e.target as HTMLDetailsElement).open)} className="rounded-md border border-gray-200 bg-white px-4 py-3">
                            <summary className="cursor-pointer text-sm text-gray-700">
                                {[formData.city.trim(), formData.zipcode.trim()].filter(Boolean).join(', ') || 'Add the town and PIN code'}
                                <span className="ml-2 text-[13px] text-gray-500">Filled from the pin. Edit</span>
                            </summary>
                            <div className="mt-3 space-y-4">
                                <Input label="Address (optional)" value={formData.hospitalAddress} onChange={(e) => setFormData({ ...formData, hospitalAddress: e.target.value })} />
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <Input label="Town or city" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} placeholder="e.g. Kochi" />
                                    <Input label="PIN code" inputMode="numeric" maxLength={6} value={formData.zipcode} onChange={(e) => setFormData({ ...formData, zipcode: e.target.value.replace(/\D/g, '').slice(0, 6) })} placeholder="e.g. 682011" />
                                </div>
                            </div>
                        </details>
                    )}
                    {(cityMismatch || zipMismatch) && pinPlace && (
                        <div role="status" className="rounded-md border-l-2 border-warning-500 bg-warning-50 px-4 py-3 text-sm text-warning-800">
                            <p>
                                The pin is in {[cityMismatch ? (pinPlace.city || pinPlace.district) : null, zipMismatch ? `PIN ${pinPlace.zipcode}` : null].filter(Boolean).join(', ')},
                                {' '}but you entered {[cityMismatch ? formData.city : null, zipMismatch ? `PIN ${formData.zipcode}` : null].filter(Boolean).join(', ')}.
                                {' '}Check the pin, or update the {cityMismatch && zipMismatch ? 'town and PIN code' : cityMismatch ? 'town' : 'PIN code'}.
                            </p>
                            <button
                                type="button"
                                className="mt-2 font-medium text-gray-900 underline underline-offset-4"
                                onClick={() => setFormData(prev => ({
                                    ...prev,
                                    city: cityMismatch ? (pinPlace.city || pinPlace.district || prev.city) : prev.city,
                                    zipcode: zipMismatch ? (pinPlace.zipcode || prev.zipcode) : prev.zipcode,
                                }))}
                            >
                                Use {[cityMismatch ? (pinPlace.city || pinPlace.district) : null, zipMismatch ? pinPlace.zipcode : null].filter(Boolean).join(', ')}
                            </button>
                        </div>
                    )}
                </>)}

                {section('Who donors should call', 'The phone number is shown only to donors who offer.', <>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Input label="Contact name" value={formData.contactName} onChange={(e) => setFormData({ ...formData, contactName: e.target.value })} required autoComplete="name" />
                        <Input label="Contact phone" type="tel" value={formData.contactPhone} onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })} required autoComplete="tel" />
                    </div>
                    <label className="flex cursor-pointer items-start gap-3">
                        <input
                            type="checkbox"
                            checked={formData.whatsappUpdates}
                            onChange={(e) => setFormData({ ...formData, whatsappUpdates: e.target.checked })}
                            className="mt-1 h-4 w-4 shrink-0 rounded-[4px] border-gray-400 accent-gray-900"
                        />
                        <span className="text-sm leading-relaxed text-gray-600">
                            <span className="block text-gray-900">Send updates on WhatsApp to this number</span>
                            When a donor offers. Numbers are never shared in WhatsApp; you get a private link instead.
                            {formData.whatsappUpdates && formData.contactPhone.trim() !== '' && !waNumber(formData.contactPhone) && (
                                <span className="mt-1 block text-warning-800">WhatsApp updates need a 10-digit Indian mobile number.</span>
                            )}
                        </span>
                    </label>
                    <Textarea
                        label="Anything donors should know (optional)"
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="For example, ward number or the best time to call"
                    />
                </>)}
            </form>

            {showConsent && (
                <p className="border-t border-gray-200 pt-6 text-sm leading-relaxed text-gray-600">
                    By continuing, you agree to the <Link href="/terms" target="_blank" className={linkClass}>Terms</Link> and confirm
                    you have read the <Link href="/privacy" target="_blank" className={linkClass}>Privacy notice</Link>.
                    {' '}The contact name and phone are stored with this request and shown to donors who offer.
                </p>
            )}

            {!user && section('Verify it’s you', 'One quick check, so requests are real. It also lets you manage this request later.', verifiedUserId ? (
                <p className="flex items-center gap-2 text-sm text-success-700">
                    <span className="h-2 w-2 rounded-full bg-success-500" /> {isLoading ? 'Verified. Posting your request…' : 'Verified. You can post your request now.'}
                </p>
            ) : (
                <>
                    <p className="text-sm leading-relaxed text-gray-600">
                        Get a code by email{PHONE_SIGNIN ? ' or on WhatsApp' : ''}; it takes about 30 seconds, and your request is posted as soon as the code is in.
                        {' '}Already registered? The same code signs you in, or{' '}
                        <Link href="/login?redirect=/requests/new" className={linkClass}>sign in</Link>.
                    </p>
                    <QuickVerify
                        consented={agreed}
                        initialPhone={formData.contactPhone}
                        emailRedirectTo={typeof window !== 'undefined' ? `${window.location.origin}/requests/new` : undefined}
                        onVerified={onVerified}
                    />
                </>
            ))}

            <p className="border-t border-gray-200 pt-6 text-[13px] leading-relaxed text-gray-500">
                Vital does not arrange, verify or guarantee a donor, and is not involved in any payment. Any contact with a
                donor is directly between you. In an emergency, also contact the hospital or a blood bank directly. See the{' '}
                <Link href="/terms" className={linkClass}>Terms</Link>.
            </p>

            <div className="mt-4 flex flex-col-reverse gap-2 pb-4 sm:flex-row sm:justify-end">
                <Button type="button" variant="ghost" onClick={() => router.push('/requests')}>Cancel</Button>
                <Button
                    type="submit"
                    form="request-form"
                    variant="primary"
                    size="lg"
                    isLoading={isLoading}
                    disabled={!userId}
                >
                    {userId ? 'Post request' : 'Verify above to post'}
                </Button>
            </div>
        </div>
    );
}
