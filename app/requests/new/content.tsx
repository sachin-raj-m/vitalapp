"use client";

import { authedFetch } from '@/lib/api';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { BLOOD_GROUPS, formatBloodGroup } from '@/lib/blood-compatibility';
import { Input, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import type { BloodGroup, UrgencyLevel } from '@/types';
import dynamic from 'next/dynamic';
import { logActivity } from '@/lib/logger';
import { toast } from 'sonner';
import { consentStamp, earliestConsentAt, hasRecordedConsent, type ConsentFields } from '@/lib/legal';
import { waNumber } from '@/lib/phone';
import { TurnstileField, type TurnstileHandle } from '@/components/TurnstileField';

const Map = dynamic(() => import('@/components/Map'), {
    ssr: false,
    loading: () => (
        <div className="h-full w-full animate-pulse bg-gray-100" />
    )
});

export default function CreateRequestPage() {
    const router = useRouter();
    const { user, loading } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        bloodGroup: '' as BloodGroup,
        unitsNeeded: 1,
        dateNeeded: '',
        hospitalName: '',
        hospitalAddress: '',
        urgencyLevel: '' as UrgencyLevel,
        notes: '',
        contactName: '',
        contactPhone: '',
        whatsappUpdates: true,
        location: {
            latitude: 0,
            longitude: 0,
            address: ''
        },
        city: '',
        zipcode: ''
    });

    // Prefill the contact with the signed-in user's details once they load.
    useEffect(() => {
        if (!user) return;
        setFormData(prev => ({
            ...prev,
            contactName: prev.contactName || user.full_name || '',
            contactPhone: prev.contactPhone || user.phone || '',
        }));
    }, [user]);

    // People without an account verify with a one-time email code inside the form.
    const [verifyEmail, setVerifyEmail] = useState('');
    const [codeSent, setCodeSent] = useState(false);
    const [code, setCode] = useState('');
    const [verifyBusy, setVerifyBusy] = useState(false);
    const captcha = useRef<TurnstileHandle>(null);
    const [verifiedUserId, setVerifiedUserId] = useState<string | null>(null);
    const [guestConsent, setGuestConsent] = useState(false);
    const userId = user?.id ?? verifiedUserId;

    // Posting needs consent recorded on the profile (enforced in the database).
    // Signed-in people who never gave it (older accounts, or Google sign-ins that
    // skipped registration) tick a box here instead.
    const [profileConsent, setProfileConsent] = useState<ConsentFields | null | undefined>(undefined);
    const [signedInConsent, setSignedInConsent] = useState(false);
    useEffect(() => {
        if (!user) return;
        let cancelled = false;
        supabase.from('profiles').select('consent_agreed, consent_at, consent_version').eq('id', user.id).maybeSingle()
            .then(({ data }) => { if (!cancelled) setProfileConsent(data ?? null); });
        return () => { cancelled = true; };
    }, [user]);
    const needsSignedInConsent = !!user && profileConsent !== undefined && !hasRecordedConsent(profileConsent);

    const sendCode = async () => {
        setError('');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(verifyEmail)) {
            setError('Enter a valid email address to get a code.');
            return;
        }
        if (!guestConsent) {
            setError('Tick the box to agree to the Terms and Privacy notice before we send a code.');
            return;
        }
        setVerifyBusy(true);
        const captchaToken = await captcha.current?.getToken();
        const { error: otpError } = await supabase.auth.signInWithOtp({
            email: verifyEmail,
            options: {
                captchaToken,
                shouldCreateUser: true,
                emailRedirectTo: `${window.location.origin}/requests/new`,
                // Recorded in auth.users when the code creates a new account
                // (the sign-up hook rejects email sign-ups without it).
                data: consentStamp(),
            },
        });
        setVerifyBusy(false);
        captcha.current?.reset(); // tokens work once
        if (otpError) {
            setError(otpError.message);
            return;
        }
        setCodeSent(true);
        toast.success('Code sent', { description: `Check ${verifyEmail}. It may take a minute to arrive.` });
    };

    const confirmCode = async () => {
        setError('');
        setVerifyBusy(true);
        const { data: otpData, error: otpError } = await supabase.auth.verifyOtp({ email: verifyEmail, token: code, type: 'email' });
        setVerifyBusy(false);
        if (otpError || !otpData.user) {
            setError('That code is incorrect or has expired. Check it or request a new one.');
            return;
        }
        setVerifiedUserId(otpData.user.id);
    };

    if (loading) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
            </div>
        );
    }

    const hasLocation = formData.location.latitude !== 0 || formData.location.longitude !== 0;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userId) {
            setError('Verify your email below before posting.');
            return;
        }
        if (needsSignedInConsent && !signedInConsent) {
            setError('Tick the box to agree to the Terms and Privacy notice before posting.');
            return;
        }
        if (!hasLocation) {
            setError('Mark the hospital on the map, or use your location, so nearby donors can find it.');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            // First-time requesters need a profile row (requests reference it).
            // They're marked as non-donors until they choose to register as one.
            if (user && needsSignedInConsent) {
                const { error: consentError } = await supabase.from('profiles').update(consentStamp()).eq('id', userId);
                if (consentError) throw consentError;
                setProfileConsent(consentStamp());
            }
            if (!user) {
                const { data: existing } = await supabase.from('profiles').select('id, blood_group, consent_agreed, consent_at, consent_version').eq('id', userId).maybeSingle();
                if (existing?.blood_group && !hasRecordedConsent(existing)) {
                    // A registered account that signed in with a code: record the
                    // consent ticked in the verify step.
                    const { error: consentError } = await supabase.from('profiles').update(consentStamp()).eq('id', userId);
                    if (consentError) throw consentError;
                }
                if (!existing?.blood_group) {
                    // Consent was given explicitly in the verify step; keep an earlier
                    // consent to the same Privacy notice version if there is one.
                    const consent = consentStamp();
                    const { error: profileError } = await supabase.from('profiles').upsert({
                        id: userId,
                        email: verifyEmail,
                        full_name: formData.contactName,
                        phone: formData.contactPhone,
                        is_donor: false,
                        is_available: false,
                        ...consent,
                        consent_at: earliestConsentAt(existing, consent) ?? consent.consent_at,
                    }, { onConflict: 'id' });
                    if (profileError) throw profileError;
                }
            }

            const { data, error: requestError } = await supabase
                .from('blood_requests')
                .insert({
                    user_id: userId,
                    blood_group: formData.bloodGroup,
                    units_needed: formData.unitsNeeded,
                    date_needed: formData.dateNeeded,
                    hospital_name: formData.hospitalName,
                    hospital_address: formData.hospitalAddress,
                    urgency_level: formData.urgencyLevel,
                    notes: formData.notes,
                    contact_name: formData.contactName,
                    location: formData.location,
                    city: formData.city,
                    zipcode: formData.zipcode,
                    status: 'active'
                })
                .select(); // Ensure the inserted data is returned

            if (requestError) throw requestError;
            const requestId = data?.[0]?.id;

            // The phone lives in request_contacts so only the requester and
            // donors who offer can read it.
            const { error: contactError } = await supabase
                .from('request_contacts')
                .insert({
                    request_id: requestId,
                    contact_phone: formData.contactPhone,
                    whatsapp_updates: formData.whatsappUpdates && !!waNumber(formData.contactPhone),
                });
            if (contactError) {
                await supabase.from('blood_requests').delete().eq('id', requestId);
                throw contactError;
            }



            // ... inside component ...

            // Trigger Push Notifications (Fire and Forget)
            // The server loads the request itself and checks it belongs to us.
            authedFetch('/api/notify/donors', {
                method: 'POST',
                body: JSON.stringify({ requestId })
            }).catch(e => console.error('Notification trigger failed', e));

            // Log Activity
            await logActivity({
                userId,
                action: 'CREATE_REQUEST',
                entityType: 'blood_requests',
                entityId: requestId,
                metadata: {
                    bloodGroup: formData.bloodGroup,
                    city: formData.city,
                    units: formData.unitsNeeded
                }
            });

            toast.success('Request posted', {
                description: `Compatible donors in ${formData.city} are being notified. You can share the request to reach more people.`
            });

            router.push(requestId ? `/requests/${requestId}` : '/requests');
        } catch (err: any) {
            setError(err.message || 'Failed to create request');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGetLocation = () => {
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setFormData(prev => ({
                        ...prev,
                        location: {
                            ...prev.location,
                            latitude: position.coords.latitude,
                            longitude: position.coords.longitude
                        }
                    }));
                },
                (error) => {
                    console.error('Error getting location', error);
                    toast.error('Unable to retrieve your location. Please check browser permissions.');
                }
            );
        } else {
            toast.error('Geolocation is not supported by your browser.');
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
                    When you post a request, registered donors in the same city whose listed blood group is compatible
                    are alerted by push notification and email. You will also get a link you can share.
                </p>
            </header>

            {error && <Alert variant="error" className="mb-6" onClose={() => setError('')}>{error}</Alert>}

            <form onSubmit={handleSubmit}>
                {section('Blood required', 'The blood group, number of units and when they are needed.', <>
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
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Input
                            type="number"
                            label="Units needed"
                            min={1}
                            max={20}
                            value={formData.unitsNeeded}
                            onChange={(e) => setFormData({ ...formData, unitsNeeded: Math.max(1, parseInt(e.target.value) || 1) })}
                            required
                        />
                        <Input
                            type="date"
                            label="Needed by"
                            value={formData.dateNeeded}
                            min={new Date().toISOString().split('T')[0]}
                            onChange={(e) => setFormData({ ...formData, dateNeeded: e.target.value })}
                            required
                        />
                    </div>
                    <div>
                        <p className="mb-1.5 text-[13px] font-medium text-gray-800">Urgency</p>
                        <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Urgency">
                            {([['High', 'Urgent', 'Today'], ['Medium', 'Needed soon', 'In a few days'], ['Low', 'Planned', 'Scheduled']] as const).map(([value, label, hint]) => (
                                <button
                                    key={value}
                                    type="button"
                                    role="radio"
                                    aria-checked={formData.urgencyLevel === value}
                                    onClick={() => setFormData({ ...formData, urgencyLevel: value })}
                                    className={`rounded-md border px-3 py-2.5 text-left transition-colors ${formData.urgencyLevel === value ? (value === 'High' ? 'border-red-600 bg-red-600 text-white' : 'border-gray-900 bg-gray-900 text-white') : 'border-gray-300 bg-white text-gray-900 hover:border-gray-400'}`}
                                >
                                    <span className="block text-sm font-medium">{label}</span>
                                    <span className={`block text-xs ${formData.urgencyLevel === value ? 'opacity-70' : 'text-gray-500'}`}>{hint}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </>)}

                {section('Hospital', 'Where the donation will take place.', <>
                    <Input label="Hospital" value={formData.hospitalName} onChange={(e) => setFormData({ ...formData, hospitalName: e.target.value })} required placeholder="e.g. General Hospital" />
                    <Input label="Address" value={formData.hospitalAddress} onChange={(e) => setFormData({ ...formData, hospitalAddress: e.target.value })} required />
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Input label="City" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} required placeholder="e.g. Kochi" helperText="Donors in this city are notified." />
                        <Input label="PIN code" inputMode="numeric" value={formData.zipcode} onChange={(e) => setFormData({ ...formData, zipcode: e.target.value })} required placeholder="e.g. 682011" />
                    </div>
                    <div>
                        <div className="mb-1.5 flex items-center justify-between">
                            <p className="text-[13px] font-medium text-gray-800">Pin the hospital on the map</p>
                            <button type="button" onClick={handleGetLocation} className="inline-flex items-center gap-1 text-[13px] text-gray-600 hover:text-gray-900">
                                <MapPin className="h-3.5 w-3.5" /> Use my location
                            </button>
                        </div>
                        <div className={`relative z-0 h-[300px] overflow-hidden rounded-md border ${hasLocation ? 'border-gray-300' : 'border-dashed border-gray-400'}`}>
                            <Map
                                interactive={true}
                                center={hasLocation ? { lat: formData.location.latitude, lng: formData.location.longitude } : { lat: 20.5937, lng: 78.9629 }}
                                zoom={hasLocation ? 14 : 5}
                                selectedPosition={hasLocation ? { lat: formData.location.latitude, lng: formData.location.longitude } : null}
                                markers={[]}
                                onLocationSelect={(loc) => setFormData(prev => ({ ...prev, location: { ...prev.location, latitude: loc.lat, longitude: loc.lng } }))}
                            />
                        </div>
                        <p className="mt-1.5 text-xs tabular-nums text-gray-500">
                            {hasLocation
                                ? `${formData.location.latitude.toFixed(4)}, ${formData.location.longitude.toFixed(4)}`
                                : 'Tap the map to mark the hospital’s location.'}
                        </p>
                    </div>
                </>)}

                {section('Contact details', 'The person donors should call. The phone number is shown only to donors who offer.', <>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Input label="Contact name" value={formData.contactName} onChange={(e) => setFormData({ ...formData, contactName: e.target.value })} required />
                        <Input label="Contact phone" type="tel" value={formData.contactPhone} onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })} required helperText="Only shown to donors who offer." />
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
                            When a donor offers, and to confirm the donation with their PIN afterwards. Numbers are never shared in WhatsApp; you’ll get a private link instead.
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

                {!user && section('Verify your email', 'Required to post without an account.', <>
                    {verifiedUserId ? (
                        <p className="flex items-center gap-2 text-sm text-success-700">
                            <span className="h-2 w-2 rounded-full bg-success-500" /> Email confirmed as {verifyEmail}. You can now post your request.
                        </p>
                    ) : (
                        <>
                            <p className="text-sm leading-relaxed text-gray-600">
                                You don’t need an account. We will email you a one-time code, which also lets you manage this request later.
                                Already registered? <Link href="/login?redirect=/requests/new" className="text-gray-900 underline decoration-gray-300 underline-offset-4">Sign in</Link>.
                            </p>
                            <label className="flex cursor-pointer items-start gap-3">
                                <input
                                    type="checkbox"
                                    checked={guestConsent}
                                    onChange={(e) => setGuestConsent(e.target.checked)}
                                    disabled={codeSent}
                                    aria-describedby={!guestConsent && !codeSent ? 'guest-consent-hint' : undefined}
                                    className="mt-1 h-4 w-4 shrink-0 rounded-[4px] border-gray-400 accent-gray-900"
                                />
                                <span className="text-sm leading-relaxed text-gray-600">
                                    I agree to the{' '}
                                    <Link href="/terms" target="_blank" className="text-gray-900 underline decoration-gray-300 underline-offset-4">Terms</Link>
                                    {' '}and have read the{' '}
                                    <Link href="/privacy" target="_blank" className="text-gray-900 underline decoration-gray-300 underline-offset-4">Privacy notice</Link>
                                    . My name and contact phone are stored with this request and shown to donors who offer.
                                </span>
                            </label>
                            {!guestConsent && !codeSent && (
                                <p id="guest-consent-hint" className="ml-7 text-[13px] text-gray-500">Tick the box to get a code.</p>
                            )}
                            {!codeSent && <TurnstileField ref={captcha} />}
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                                <div className="flex-1">
                                    <Input label="Your email" type="email" autoComplete="email" value={verifyEmail} onChange={(e) => setVerifyEmail(e.target.value)} disabled={codeSent} />
                                </div>
                                <Button type="button" variant="secondary" onClick={codeSent ? () => { setCodeSent(false); setCode(''); } : sendCode} isLoading={verifyBusy && !codeSent}
                                    disabled={!codeSent && !guestConsent}
                                    aria-describedby={!codeSent && !guestConsent ? 'guest-consent-hint' : undefined}>
                                    {codeSent ? 'Change email' : 'Send code'}
                                </Button>
                            </div>
                            {codeSent && (
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                                    <div className="flex-1">
                                        <Input
                                            label="Code from the email"
                                            inputMode="numeric"
                                            autoComplete="one-time-code"
                                            value={code}
                                            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                                            className="font-mono tracking-[0.3em]"
                                        />
                                    </div>
                                    <Button type="button" variant="ink" onClick={confirmCode} isLoading={verifyBusy} disabled={code.length < 6}>
                                        Verify
                                    </Button>
                                </div>
                            )}
                        </>
                    )}
                </>)}

                <p className="border-t border-gray-200 pt-6 text-[13px] leading-relaxed text-gray-500">
                    Posting makes your request visible to donors on Vital. Vital does not arrange, verify or guarantee a
                    donor, and is not involved in any payment. You are responsible for the accuracy of your request, and
                    any contact with a donor is directly between you, at your own discretion. In an emergency, also contact
                    the hospital or a blood bank directly. See the{' '}
                    <Link href="/terms" className="text-gray-900 underline decoration-gray-300 underline-offset-4">Terms</Link>.
                </p>

                {needsSignedInConsent && (
                    <label className="mt-4 flex cursor-pointer items-start gap-3">
                        <input
                            type="checkbox"
                            checked={signedInConsent}
                            onChange={(e) => setSignedInConsent(e.target.checked)}
                            aria-describedby={!signedInConsent ? 'signed-in-consent-hint' : undefined}
                            className="mt-1 h-4 w-4 shrink-0 rounded-[4px] border-gray-400 accent-gray-900"
                        />
                        <span className="text-sm leading-relaxed text-gray-600">
                            I agree to the{' '}
                            <Link href="/terms" target="_blank" className="text-gray-900 underline decoration-gray-300 underline-offset-4">Terms</Link>
                            {' '}and have read the{' '}
                            <Link href="/privacy" target="_blank" className="text-gray-900 underline decoration-gray-300 underline-offset-4">Privacy notice</Link>
                            . My name and contact phone are stored with this request and shown to donors who offer.
                            {!signedInConsent && <span id="signed-in-consent-hint" className="mt-1 block text-[13px] text-gray-500">Tick the box to post your request.</span>}
                        </span>
                    </label>
                )}

                <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button type="button" variant="ghost" onClick={() => router.push('/requests')}>Cancel</Button>
                    <Button
                        type="submit"
                        variant="primary"
                        size="lg"
                        isLoading={isLoading}
                        disabled={!formData.bloodGroup || !formData.urgencyLevel || !userId || (needsSignedInConsent && !signedInConsent)}
                    >
                        Post request
                    </Button>
                </div>
            </form>
        </div>
    );
}
