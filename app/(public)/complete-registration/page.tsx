"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input, Select } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { authedFetch } from '@/lib/api';
import { BLOOD_GROUPS, formatBloodGroup } from '@/lib/blood-compatibility';
import type { BloodGroup } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { cleanNext, isRegistrationComplete, rememberNext, takeNext } from '@/lib/auth-helpers';
import { addDays } from 'date-fns';
import { toast } from 'sonner';
import Link from 'next/link';
import { PRIVACY_VERSION, earliestConsentAt, hasRecordedConsent } from '@/lib/legal';
import { takeReferral } from '@/lib/referrals';
import { MATCH_RADIUS_KM } from '@/lib/geo';
import { DonorLocationPicker } from '@/components/DonorLocationPicker';
import { PHONE_TAKEN, formatWaNumber, isPhoneTakenError, waNumber } from '@/lib/phone';
import { WHATSAPP_VERIFY_NUMBER } from '@/lib/features';
import { WhatsAppVerify } from '@/components/WhatsAppVerify';
import { StateDistrictSelect } from '@/components/StateDistrictSelect';
import { districtsOf, resolveRegion } from '@/lib/india-regions';

/**
 * Becoming a donor, in two parts:
 *
 *   1. The minimum to be matched (required): name, mobile, blood group, state
 *      and district (PIN code optional), and one box confirming they can
 *      donate and agree to share their details when they offer (it also
 *      records agreement to the Terms and Privacy notice for accounts that
 *      haven't given it yet, e.g. Google from the sign-in page). Completes registration
 *      (isRegistrationComplete: name + state + district).
 *   2. Optional details, right after or later from the dashboard
 *      (/complete-registration?step=more): last donation date, gender, date of
 *      birth, usual availability, permanent PIN, exact alert location and
 *      verifying the number on WhatsApp.
 *
 * Someone only here to request blood can skip to the request form; they are
 * not asked again (lib/auth-helpers.ts accountStage).
 *
 * ?redirect= (or rememberNext) is where they were heading, e.g. offering to
 * donate for a request: they go there when done instead of the dashboard.
 */

interface BasicsForm {
    fullName: string;
    phone: string;
    bloodGroup: BloodGroup | '';
    state: string;
    district: string;
    presentZip: string;
    whatsappAlerts: boolean;
    /** Can donate, and agrees to share name and number when offering. */
    ready: boolean;
}

interface MoreForm {
    lastDonationDate: string;
    gender: string;
    dob: string;
    availability: string[];
    permanentZip: string;
}

type Status = 'loading' | 'form' | 'saving' | 'more' | 'saving_more' | 'error';

const ageOn = (dob: string) => {
    const birth = new Date(dob);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--;
    return age;
};

export default function CompleteRegistration() {
    const router = useRouter();
    const { user, session, loading: authLoading, refreshProfile } = useAuth();
    const [error, setError] = useState('');
    const [status, setStatus] = useState<Status>('loading');
    const [form, setForm] = useState<BasicsForm>({
        fullName: '', phone: '', bloodGroup: '', state: '', district: '', presentZip: '',
        whatsappAlerts: true, ready: false,
    });
    const [more, setMore] = useState<MoreForm>({ lastDonationDate: '', gender: '', dob: '', availability: [], permanentZip: '' });
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    // A blood group saved earlier can't be changed here (only once, from Settings).
    const [savedBloodGroup, setSavedBloodGroup] = useState<BloodGroup | null>(null);
    // A number proven by signing in with it (or verified earlier) isn't edited here.
    const [phoneVerified, setPhoneVerified] = useState(false);
    const [savedNextEligible, setSavedNextEligible] = useState<string | null>(null);
    // A state or district typed by hand before the dropdowns, for the hint.
    const [typedRegion, setTypedRegion] = useState<{ state: string; district: string }>({ state: '', district: '' });
    const [skipping, setSkipping] = useState(false);
    // Agreed to the current Terms and Privacy notice already (when joining):
    // the box below then doesn't ask again.
    const [alreadyAgreed, setAlreadyAgreed] = useState(false);
    // Set once loaded or submitted, so later profile reloads don't reset the page.
    const started = useRef(false);
    // Where to go when done (see the comment at the top).
    const next = useRef('');
    const done = () => router.push(next.current || '/dashboard');

    useEffect(() => {
        // Wait for auth to settle; `user` is null while loading.
        if (authLoading || started.current) return;
        const init = async () => {
            const params = new URLSearchParams(window.location.search);
            if (!user) {
                rememberNext(params.get('redirect'));
                router.replace('/login?redirect=/complete-registration');
                return;
            }
            started.current = true;
            next.current = cleanNext(params.get('redirect')) || takeNext();
            const wantsMore = params.get('step') === 'more';
            const complete = await isRegistrationComplete(user.id);
            if (complete && !wantsMore) {
                router.replace(next.current || '/dashboard');
                return;
            }

            // Start from what's already saved, so people only add what's missing.
            const { data: saved } = await supabase
                .from('profiles')
                .select('full_name, phone, phone_verified_at, dob, gender, blood_group, district, state, permanent_zip, present_zip, availability, whatsapp_alerts, next_eligible_date, consent_agreed, consent_at, consent_version')
                .eq('id', user.id)
                .maybeSingle();
            const authPhone = session?.user?.phone ? waNumber(session.user.phone)?.slice(2) ?? '' : '';
            if (saved) {
                const region = resolveRegion(saved.state, saved.district);
                setTypedRegion({ state: region.state ? '' : saved.state || '', district: region.district ? '' : saved.district || '' });
                setForm(prev => ({
                    ...prev,
                    fullName: saved.full_name || (session?.user?.user_metadata?.full_name as string) || '',
                    phone: saved.phone || authPhone,
                    bloodGroup: (saved.blood_group as BloodGroup) || '',
                    district: region.district,
                    state: region.state,
                    presentZip: saved.present_zip || '',
                    whatsappAlerts: saved.whatsapp_alerts ?? true,
                }));
                setMore({
                    lastDonationDate: '',
                    gender: saved.gender || '',
                    dob: saved.dob || '',
                    availability: saved.availability?.length ? saved.availability : [],
                    permanentZip: saved.permanent_zip || '',
                });
                if (saved.blood_group) setSavedBloodGroup(saved.blood_group as BloodGroup);
                setPhoneVerified(!!saved.phone_verified_at && !!saved.phone);
                setSavedNextEligible(saved.next_eligible_date || null);
                if (hasRecordedConsent(saved) && saved.consent_version === PRIVACY_VERSION) setAlreadyAgreed(true);
            } else if (authPhone) {
                setForm(prev => ({ ...prev, phone: authPhone }));
            }
            // Ticked on the Join page just before continuing with Google.
            try {
                const pending = JSON.parse(localStorage.getItem('pendingConsent') || 'null');
                if (pending?.consent_version === PRIVACY_VERSION && Date.now() - Date.parse(pending.consent_at) < 30 * 60 * 1000) setAlreadyAgreed(true);
            } catch { /* storage blocked */ }
            setStatus(complete && wantsMore ? 'more' : 'form');
        };
        init().catch(err => {
            console.error('Registration load error:', err);
            setError('We couldn’t load your details. Please reload the page.');
            setStatus('error');
        });
    }, [router, user, session, authLoading]);

    const set = <K extends keyof BasicsForm>(key: K, value: BasicsForm[K]) => setForm(prev => ({ ...prev, [key]: value }));
    const setM = <K extends keyof MoreForm>(key: K, value: MoreForm[K]) => setMore(prev => ({ ...prev, [key]: value }));

    const validate = () => {
        const errors: Record<string, string> = {};
        if (!form.fullName.trim()) errors.fullName = 'Enter your name';
        if (!form.phone.trim()) errors.phone = 'Enter your mobile number';
        else if (form.whatsappAlerts && !waNumber(form.phone)) errors.phone = 'Enter a 10-digit Indian mobile number for WhatsApp alerts, or untick WhatsApp alerts.';
        if (!form.bloodGroup) errors.bloodGroup = 'Choose your blood group';
        if (!form.state) errors.state = 'Choose your state';
        if (!form.district || !districtsOf(form.state).includes(form.district)) errors.district = 'Choose your district';
        if (form.presentZip.trim() && !/^[1-9][0-9]{5}$/.test(form.presentZip.trim())) errors.presentZip = 'Enter a 6-digit PIN code, or leave it empty';
        if (!form.ready) errors.ready = 'Tick the box to confirm you can donate. If you can’t, you can still request blood.';
        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!validate()) {
            document.querySelector('[aria-invalid="true"], [data-error="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
        setStatus('saving');
        try {
            const { data: { session: current }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) throw sessionError;
            if (!current || current.user.id !== user?.id) {
                router.push('/login?redirect=/complete-registration');
                return;
            }

            // Keep the first time this person agreed to the current Privacy notice
            // (sign-up, a guest request, or an earlier save) rather than now.
            // Ticking the box here is itself consent.
            const { data: existingConsent } = await supabase
                .from('profiles')
                .select('consent_at, consent_version')
                .eq('id', current.user.id)
                .maybeSingle();
            let pendingConsent: { consent_at?: string; consent_version?: string } | null = null;
            try { pendingConsent = JSON.parse(localStorage.getItem('pendingConsent') || 'null'); } catch { /* ignore */ }
            // Only trust the locally remembered (Google) consent if it was given just before this account was created.
            if (pendingConsent?.consent_at && Date.parse(pendingConsent.consent_at) < Date.parse(current.user.created_at) - 30 * 60 * 1000) {
                pendingConsent = null;
            }
            const consentAt = earliestConsentAt(existingConsent, current.user.user_metadata, pendingConsent) ?? new Date().toISOString();

            const { error: profileError } = await supabase
                .from('profiles')
                .upsert({
                    id: current.user.id,
                    full_name: form.fullName.trim(),
                    // A verified number stays as it is (changing it would unverify it).
                    ...(phoneVerified ? {} : { phone: form.phone.trim() }),
                    blood_group: form.bloodGroup || null,
                    // City isn't asked any more: kept equal to the district for older readers.
                    city: form.district,
                    district: form.district,
                    state: form.state,
                    ...(form.presentZip.trim() ? { present_zip: form.presentZip.trim() } : {}),
                    has_medical_conditions: false,
                    consent_agreed: true,
                    consent_at: consentAt,
                    consent_version: PRIVACY_VERSION,
                    // Eligible now unless an earlier save knew better; the last
                    // donation date (optional, next step) refines it.
                    next_eligible_date: savedNextEligible || new Date().toISOString(),
                    is_donor: true,
                    is_available: true,
                    whatsapp_alerts: form.whatsappAlerts && !!waNumber(form.phone),
                }, { onConflict: 'id' });

            if (isPhoneTakenError(profileError)) {
                setFieldErrors({ phone: `${PHONE_TAKEN} Sign in to that account, or use your own number.` });
                setStatus('form');
                return;
            }
            if (profileError) throw profileError;

            // Credit whoever invited this donor (best effort; the database checks it).
            const referralCode = takeReferral();
            if (referralCode) {
                await supabase.rpc('claim_referral', { p_code: referralCode }).then(() => {}, () => {});
            }

            // Place the donor at their PIN code centre (server-side). Without it
            // they are still matched by district. Never blocks registration.
            if (form.presentZip.trim()) {
                await Promise.race([
                    authedFetch('/api/profile/location', { method: 'POST', keepalive: true, body: JSON.stringify({ mode: 'pin' }) }).catch(() => {}),
                    new Promise(resolve => setTimeout(resolve, 5000)),
                ]);
            }

            await supabase.auth.updateUser({
                data: {
                    registration_completed: true,
                    full_name: form.fullName.trim(),
                    consent_agreed: true,
                    consent_at: consentAt,
                    consent_version: PRIVACY_VERSION,
                },
            }).then(() => {}, () => {}); // metadata is a copy; the profile is the record

            await refreshProfile();
            try {
                localStorage.removeItem('pendingRegistration');
                localStorage.removeItem('pendingConsent');
            } catch { /* storage blocked */ }
            toast.success('You’re on the network', {
                description: 'We’ll alert you when someone nearby needs your blood group.',
            });
            setStatus('more');
            window.scrollTo({ top: 0 });
        } catch (err: any) {
            console.error('Registration completion error:', err);
            setError(err?.message || 'Failed to complete registration');
            setStatus('error');
        }
    };

    const saveMore = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        const errors: Record<string, string> = {};
        if (more.dob) {
            const age = ageOn(more.dob);
            if (age < 18 || age > 65) errors.dob = 'Donors need to be 18 to 65. Check the date, or leave it empty.';
        }
        if (more.permanentZip.trim() && !/^[1-9][0-9]{5}$/.test(more.permanentZip.trim())) errors.permanentZip = 'Enter a 6-digit PIN code, or leave it empty';
        setFieldErrors(errors);
        if (Object.keys(errors).length) return;
        if (!user) return;

        setStatus('saving_more');
        const update: Record<string, unknown> = {};
        if (more.dob) update.dob = more.dob;
        if (more.gender) update.gender = more.gender;
        if (more.availability.length) update.availability = more.availability;
        if (more.permanentZip.trim()) update.permanent_zip = more.permanentZip.trim();
        // Only the next eligible date is stored (as before), worked out from the last donation.
        if (more.lastDonationDate) {
            update.next_eligible_date = addDays(new Date(more.lastDonationDate), more.gender === 'Female' ? 120 : 90).toISOString();
        }
        if (Object.keys(update).length) {
            const { error: updateError } = await supabase.from('profiles').update(update).eq('id', user.id);
            if (updateError) {
                setError('We couldn’t save these details. Please try again.');
                setStatus('more');
                return;
            }
            await refreshProfile({ silent: true });
            toast.success('Details saved');
        }
        done();
    };

    const skipAsRequester = async () => {
        setSkipping(true);
        // Remembered on the account so the donor form isn't shown again.
        await supabase.auth.updateUser({ data: { account_type: 'requester' } }).then(() => {}, () => {});
        router.push(next.current.startsWith('/requests') ? next.current : '/requests/new');
    };

    const checkbox = (name: string, checked: boolean, onChange: (v: boolean) => void, title: string, body: React.ReactNode, err?: string) => (
        <div data-error={err ? 'true' : undefined}>
            <label className="flex cursor-pointer items-start gap-3">
                <input type="checkbox" name={name} checked={checked} onChange={e => onChange(e.target.checked)} aria-invalid={!!err || undefined} className="mt-1 h-4 w-4 shrink-0 rounded-[4px] border-gray-400 accent-gray-900" />
                <span className="text-sm leading-relaxed text-gray-600">
                    <span className="block font-medium text-gray-900">{title}</span>
                    {body}
                </span>
            </label>
            {err && <p className="ml-7 mt-1.5 text-[13px] text-red-700">{err}</p>}
        </div>
    );

    const section = (title: string, hint: string, children: React.ReactNode) => (
        <section className="grid gap-6 border-t border-gray-200 py-8 md:grid-cols-3 md:gap-10">
            <div>
                <h2 className="font-medium text-gray-900">{title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-gray-500">{hint}</p>
            </div>
            <div className="space-y-4 md:col-span-2">{children}</div>
        </section>
    );

    const linkClass = 'text-gray-900 underline decoration-gray-300 underline-offset-4';

    if (status === 'loading' || status === 'saving') {
        return (
            <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-5">
                <p className="text-sm text-gray-500">Please wait</p>
                <p className="display mt-2 text-3xl sm:text-4xl">{status === 'loading' ? 'Loading…' : 'Setting up your profile…'}</p>
            </div>
        );
    }

    if (status === 'error') {
        return (
            <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-5">
                <p className="display text-3xl sm:text-4xl">We couldn’t save your details</p>
                <p className="mt-4 text-gray-600">{error}</p>
                <Button variant="ink" className="mt-8 self-start" onClick={() => { setError(''); setStatus('form'); }}>Back to the form</Button>
            </div>
        );
    }

    if (status === 'more' || status === 'saving_more') {
        const wa = waNumber(user?.phone || form.phone);
        const canVerify = !!WHATSAPP_VERIFY_NUMBER && !!wa && !user?.phone_verified_at;
        return (
            <div className="mx-auto max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
                <header className="pb-8">
                    <p className="text-sm text-success-700">You’re on the network</p>
                    <h1 className="display mt-2 text-4xl sm:text-[2.75rem]">A few more details</h1>
                    <p className="mt-3 max-w-xl leading-relaxed text-gray-600">
                        All optional. They help us alert you only when you can donate. You can skip this and add them later.
                    </p>
                </header>

                {error && <Alert variant="error" className="mb-6">{error}</Alert>}

                <form onSubmit={saveMore} noValidate>
                    {canVerify && section('Verify your number', 'One WhatsApp message. Verified numbers can’t be used by another account.', <>
                        <p className="text-sm text-gray-600">Send one message from {formatWaNumber(wa!)} to confirm it’s yours.</p>
                        <WhatsAppVerify size="sm" onVerified={async () => { await refreshProfile({ silent: true }); toast.success('Your number is verified'); }} />
                    </>)}

                    {section('Your last donation', 'Donors wait 90 days (men) or 120 days (women) between donations. We pause alerts until then.', <>
                        <Input
                            label="Date of your last donation (if any)"
                            type="date"
                            value={more.lastDonationDate}
                            max={new Date().toISOString().split('T')[0]}
                            onChange={e => setM('lastDonationDate', e.target.value)}
                        />
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Select
                                label="Gender"
                                value={more.gender}
                                onChange={e => setM('gender', e.target.value)}
                                options={[
                                    { value: '', label: 'Prefer not to say' },
                                    { value: 'Male', label: 'Male' },
                                    { value: 'Female', label: 'Female' },
                                    { value: 'Other', label: 'Other' },
                                ]}
                            />
                            <Input label="Date of birth" type="date" value={more.dob} onChange={e => setM('dob', e.target.value)} error={fieldErrors.dob} />
                        </div>
                    </>)}

                    {section('When and where', 'Helps us alert you at the right times and from the right place.', <>
                        <div>
                            <p className="mb-2 text-[13px] font-medium text-gray-800">Usually available on</p>
                            <div className="flex flex-wrap gap-1.5">
                                {['Weekdays', 'Weekends'].map(day => {
                                    const on = more.availability.includes(day);
                                    return (
                                        <button
                                            key={day}
                                            type="button"
                                            aria-pressed={on}
                                            onClick={() => setM('availability', on ? more.availability.filter(d => d !== day) : [...more.availability, day])}
                                            className={`h-9 rounded-full border px-4 text-sm transition-colors ${on ? 'border-gray-900 bg-gray-900 text-gray-50' : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'}`}
                                        >
                                            {day}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <Input label="Permanent PIN code" inputMode="numeric" value={more.permanentZip} onChange={e => setM('permanentZip', e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="e.g. 682011" error={fieldErrors.permanentZip} helperText="If it’s different from where you live now." />
                        <div>
                            <h3 className="mb-1 text-[13px] font-medium text-gray-800">Where we alert you from</h3>
                            <DonorLocationPicker mode="save" value={user?.location} onSaved={() => { refreshProfile({ silent: true }).catch(() => {}); }} />
                        </div>
                    </>)}

                    <div className="flex flex-col-reverse gap-3 border-t border-gray-200 pt-6 sm:flex-row sm:justify-end">
                        <Button type="button" variant="ghost" size="lg" onClick={done}>Skip for now</Button>
                        <Button type="submit" variant="primary" size="lg" isLoading={status === 'saving_more'}>Save and continue</Button>
                    </div>
                </form>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
            <header className="pb-8">
                <p className="text-sm text-gray-500">Last step</p>
                <h1 className="display mt-2 text-4xl sm:text-[2.75rem]">Join as a donor</h1>
                <p className="mt-3 max-w-xl leading-relaxed text-gray-600">
                    Just what we need to alert you when your blood group is needed near you (within about {MATCH_RADIUS_KM} km).
                    It takes about a minute.
                </p>
                <p className="mt-3 text-sm text-gray-600">
                    Only here to request blood?{' '}
                    <button type="button" onClick={skipAsRequester} disabled={skipping} className={`${linkClass} disabled:opacity-60`}>
                        Skip this and post a request
                    </button>
                </p>
            </header>

            {error && <Alert variant="error" className="mb-6">{error}</Alert>}

            <form onSubmit={handleSubmit} noValidate>
                {section('You', 'Your name and number are shared with a requester only after you offer to donate.', <>
                    <Input
                        label="Full name"
                        value={form.fullName}
                        onChange={e => set('fullName', e.target.value)}
                        required
                        autoComplete="name"
                        autoCapitalize="words"
                        // Start typing straight away, unless the name came from Google or an earlier request.
                        autoFocus={!form.fullName}
                        error={fieldErrors.fullName}
                    />
                    <Input
                        label="Mobile number"
                        type="tel"
                        inputMode="tel"
                        value={form.phone}
                        onChange={e => set('phone', e.target.value)}
                        required
                        readOnly={phoneVerified}
                        autoComplete="tel"
                        placeholder="98765 43210"
                        error={fieldErrors.phone}
                        helperText={phoneVerified ? 'Verified. You can change it later in Settings.' : 'Each number can belong to only one Vital account.'}
                    />
                    {checkbox(
                        'whatsappAlerts',
                        form.whatsappAlerts,
                        v => set('whatsappAlerts', v),
                        'Send me alerts on WhatsApp',
                        'Only when someone nearby needs your blood group. Reply STOP any time.',
                    )}
                </>)}

                {section('Blood group', savedBloodGroup
                    ? 'Already saved. If it’s wrong, you can change it once from Settings.'
                    : 'Not sure? Check a recent blood test report or ask a blood bank.', <>
                    <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Blood group" aria-disabled={!!savedBloodGroup} data-error={fieldErrors.bloodGroup ? 'true' : undefined}>
                        {BLOOD_GROUPS.map(g => (
                            <button
                                key={g}
                                type="button"
                                role="radio"
                                aria-checked={form.bloodGroup === g}
                                disabled={!!savedBloodGroup && g !== savedBloodGroup}
                                onClick={() => set('bloodGroup', g)}
                                className={`h-14 rounded-md border font-serif text-3xl transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${form.bloodGroup === g ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 bg-white text-gray-900 hover:border-gray-400'}`}
                            >
                                {formatBloodGroup(g)}
                            </button>
                        ))}
                    </div>
                    {fieldErrors.bloodGroup && <p className="text-[13px] text-red-700">{fieldErrors.bloodGroup}</p>}
                </>)}

                {section('Where you live', 'Decides which requests you’re alerted to.', <>
                    <StateDistrictSelect
                        state={form.state}
                        district={form.district}
                        onChange={region => setForm(prev => ({ ...prev, ...region }))}
                        previousState={typedRegion.state}
                        previousDistrict={typedRegion.district}
                        required
                        stateError={fieldErrors.state}
                        districtError={fieldErrors.district}
                    />
                    <Input
                        label="PIN code (optional)"
                        inputMode="numeric"
                        autoComplete="postal-code"
                        value={form.presentZip}
                        onChange={e => set('presentZip', e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="e.g. 682011"
                        error={fieldErrors.presentZip}
                        helperText="Lets us alert you to hospitals close by, not just in your district."
                    />
                </>)}

                {section('Before you join', 'Your own declaration. Vital does not check it; the hospital or blood bank decides who can donate.', <>
                    {checkbox(
                        'ready',
                        form.ready,
                        v => set('ready', v),
                        'I can donate, and I agree to share my details when I offer',
                        <>
                            I’m 18 to 65, weigh at least 45 kg and am in good health (<Link href="/safety-guidelines" target="_blank" className={linkClass}>who can donate</Link>).
                            My name and mobile number go to a requester only when I offer to donate.
                            {alreadyAgreed ? <>
                                {' '}As in the <Link href="/privacy" target="_blank" className={linkClass}>Privacy notice</Link> you agreed to,
                                Vital only connects people; any contact or donation is my own decision.
                            </> : <>
                                {' '}I agree to the <Link href="/terms" target="_blank" className={linkClass}>Terms</Link> and have read the{' '}
                                <Link href="/privacy" target="_blank" className={linkClass}>Privacy notice</Link>.
                                {' '}Vital only connects people; any contact or donation is my own decision.
                            </>}
                        </>,
                        fieldErrors.ready,
                    )}
                </>)}

                <div className="flex justify-end border-t border-gray-200 pt-6">
                    <Button type="submit" variant="primary" size="lg" className="w-full sm:w-auto">
                        Join as a donor
                    </Button>
                </div>
            </form>
        </div>
    );
}
