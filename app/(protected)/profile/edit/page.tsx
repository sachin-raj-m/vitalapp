"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { useAuth } from '@/context/AuthContext';
import { authedFetch } from '@/lib/api';
import { AlertCircle, ArrowLeft, Bell, CheckCircle2, HeartPulse, KeyRound, MapPin, PauseCircle, ShieldCheck, UserRound } from 'lucide-react';
import { SecuritySettings } from '@/app/(protected)/profile/SecuritySettings';
import { PushNotificationManager } from '@/components/PushNotificationManager';
import { formatWaNumber, waNumber } from '@/lib/phone';
import { WHATSAPP_LIVE, WHATSAPP_VERIFY_NUMBER } from '@/lib/features';
import { WhatsAppVerify } from '@/components/WhatsAppVerify';
import { BLOOD_GROUPS, formatBloodGroup } from '@/lib/blood-compatibility';
import type { BloodGroup } from '@/types';
import { MATCH_RADIUS_KM } from '@/lib/geo';
import { DonorLocationPicker } from '@/components/DonorLocationPicker';
import { isPrecise, usableLocation } from '@/lib/location';
import { contactVerification } from '@/lib/verification';
import { cn } from '@/lib/cn';
import { StateDistrictSelect } from '@/components/StateDistrictSelect';
import { districtsOf, resolveRegion } from '@/lib/india-regions';

export default function ProfileEditPage() {
    const router = useRouter();
    const { user, session, updateProfile, refreshProfile } = useAuth();
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const [editForm, setEditForm] = useState({
        full_name: '',
        phone: '',
        is_available: false,
        permanent_zip: '',
        present_zip: '',
        state: '',
        district: '',
        is_public_profile: false,
        whatsapp_alerts: false,
        blood_group: '' as BloodGroup | '',
    });

    // OTP Verification State
    const [isVerifying, setIsVerifying] = useState(false);
    const [otp, setOtp] = useState('');
    const [pendingPhone, setPendingPhone] = useState('');

    // Fill the form from the profile, and again whenever a newer copy arrives
    // (the first one can be the browser's cached copy, older than the database:
    // e.g. before a WhatsApp START or verification). Once the person has edited
    // something, later reloads must not wipe those unsaved edits.
    const lastFilled = useRef<typeof editForm | null>(null);
    const [locationErrors, setLocationErrors] = useState<{ state?: string; district?: string }>({});
    useEffect(() => {
        if (!user) return;
        // A hand-typed state or district (from before the dropdowns) is shown
        // as the listed name it matches, or left empty for the person to pick.
        const region = resolveRegion(user.state, user.district);
        const fresh = {
            full_name: user.full_name || '',
            phone: user.phone || '',
            is_available: user.is_available || false,
            permanent_zip: user.permanent_zip || '',
            present_zip: user.present_zip || '',
            state: region.state,
            district: region.district,
            is_public_profile: user.is_public_profile || false,
            whatsapp_alerts: user.whatsapp_alerts || false,
            blood_group: (user.blood_group as BloodGroup) || '',
        };
        setEditForm(current => {
            const same = (a: typeof current) => JSON.stringify(a) === JSON.stringify(current);
            // Untouched, or already equal to the new copy (e.g. right after saving).
            const untouched = !lastFilled.current || same(lastFilled.current) || same(fresh);
            if (!untouched) return current;
            lastFilled.current = fresh;
            return fresh;
        });
    }, [user]);

    // After a save that changed the PIN code, re-derive the map position on the
    // server (it keeps a location the donor set precisely if it's still within
    // the new PIN area). Fire-and-forget: a failure only means ranking by PIN area.
    const refreshLocationIfPinChanged = (previousZip: string | null | undefined) => {
        if ((previousZip || '').trim() === editForm.present_zip.trim()) return;
        authedFetch('/api/profile/location', { method: 'POST', keepalive: true, body: JSON.stringify({ mode: 'pin' }) }).catch(() => {});
    };

    // Everything except the phone number, which has its own flow below.
    const saveOtherFields = async () => {
        await updateProfile({
            full_name: editForm.full_name,
            is_available: editForm.is_available,
            permanent_zip: editForm.permanent_zip,
            present_zip: editForm.present_zip,
            // Only names picked from the list are saved. An old typed value
            // that didn't match stays as it is until the person picks one.
            // City isn't asked any more: kept equal to the district.
            ...(editForm.state ? { state: editForm.state } : {}),
            ...(editForm.district ? { district: editForm.district, city: editForm.district } : {}),
            is_public_profile: editForm.is_public_profile,
            whatsapp_alerts: editForm.whatsapp_alerts,
        });
    };

    const finish = (message: string) => {
        setSuccess(message);
        setTimeout(() => router.push('/profile'), 1500);
    };

    // Starts a phone change (or re-verifies the current number). With WhatsApp
    // live, a code is sent there; otherwise the number is saved straight away.
    const startPhoneVerification = async (phone: string) => {
        const res = await authedFetch('/api/profile/phone', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'start', phone }),
        });
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.error || 'Could not update your number.');
        if (body?.sent) {
            setPendingPhone(body.to);
            setOtp('');
            setIsVerifying(true);
        }
        return body as { sent?: boolean; saved?: boolean };
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setError('');
        setSuccess('');
        const previousZip = user?.present_zip;

        const regionTouched = !!lastFilled.current
            && (editForm.state !== lastFilled.current.state || editForm.district !== lastFilled.current.district);
        const problems: typeof locationErrors = {};
        if (regionTouched && !editForm.state) problems.state = 'Choose your state';
        if ((regionTouched || editForm.district) && !districtsOf(editForm.state).includes(editForm.district)) problems.district = 'Choose your district';
        setLocationErrors(problems);
        if (Object.keys(problems).length) {
            setError('Check your location details.');
            document.getElementById('location')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
        }

        if (editForm.whatsapp_alerts && !waNumber(editForm.phone)) {
            setError('WhatsApp alerts need a 10-digit Indian mobile number. Update your phone number or turn WhatsApp alerts off.');
            return;
        }

        setIsLoading(true);
        try {
            await saveOtherFields();
            refreshLocationIfPinChanged(previousZip);

            if (editForm.phone.trim() !== (user?.phone || '').trim()) {
                const result = await startPhoneVerification(editForm.phone);
                if (result.sent) {
                    // The rest is saved; the number is saved once the code is confirmed.
                    setIsLoading(false);
                    return;
                }
                await refreshProfile();
                if (WHATSAPP_VERIFY_NUMBER && waNumber(editForm.phone)) {
                    // Stay here so the new number can be verified straight away.
                    setSuccess('Your changes have been saved. Now verify your new number on WhatsApp below.');
                    setIsLoading(false);
                    return;
                }
            }
            finish('Your changes have been saved.');
        } catch (err: any) {
            console.error('Error updating profile:', err);
            setError(err.message || 'Failed to update profile');
            setIsLoading(false);
        }
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setError('');
        setIsLoading(true);
        try {
            const res = await authedFetch('/api/profile/phone', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'confirm', code: otp }),
            });
            const body = await res.json().catch(() => null);
            if (!res.ok) throw new Error(body?.error || 'That code isn’t right.');
            await refreshProfile();
            setIsVerifying(false);
            finish('Your number is confirmed and saved.');
        } catch (err: any) {
            setError(err.message || 'Invalid verification code');
            setIsLoading(false);
        }
    };

    const resendCode = async () => {
        setError('');
        try {
            await startPhoneVerification(editForm.phone);
            setSuccess('New code sent on WhatsApp.');
        } catch (err: any) {
            setError(err.message);
        }
    };

    // Blood group: one change after registration, confirmed with an emailed code
    // (app/api/profile/blood-group; the database refuses direct changes).
    const [bgCodeOpen, setBgCodeOpen] = useState(false);
    const [bgCode, setBgCode] = useState('');
    const [bgSentTo, setBgSentTo] = useState('');
    const [bgBusy, setBgBusy] = useState(false);
    const [bgError, setBgError] = useState('');
    const bloodGroupLocked = !!user?.blood_group_changed_at;
    const bloodGroupPending = !!editForm.blood_group && editForm.blood_group !== user?.blood_group;

    const bloodGroupCall = async (payload: Record<string, unknown>) => {
        const res = await authedFetch('/api/profile/blood-group', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.error || 'Something went wrong. Please try again.');
        return body;
    };

    const startBloodGroupChange = async () => {
        setBgError(''); setError(''); setBgBusy(true);
        try {
            const body = await bloodGroupCall({ action: 'start', bloodGroup: editForm.blood_group });
            setBgSentTo(body.to); setBgCode(''); setBgCodeOpen(true);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setBgBusy(false);
        }
    };

    const confirmBloodGroupChange = async (e: React.FormEvent) => {
        e.preventDefault();
        setBgError(''); setBgBusy(true);
        try {
            await bloodGroupCall({ action: 'confirm', code: bgCode });
            await refreshProfile();
            setBgCodeOpen(false);
            setSuccess(`Your blood group is now ${formatBloodGroup(editForm.blood_group)}.`);
        } catch (err: any) {
            setBgError(err.message);
        } finally {
            setBgBusy(false);
        }
    };

    const phoneChanged = editForm.phone.trim() !== (user?.phone || '').trim();
    const unverified = !phoneChanged && !!user?.phone && !user?.phone_verified_at && !!waNumber(user.phone);
    // Preferred: the person messages Vital ("VERIFY <code>"), which needs no
    // template. Otherwise the older code-by-template flow, once WhatsApp is live.
    const verifyByMessage = unverified && !!WHATSAPP_VERIFY_NUMBER;
    const verifyByTemplate = unverified && !WHATSAPP_VERIFY_NUMBER && WHATSAPP_LIVE;
    const phoneHint = WHATSAPP_VERIFY_NUMBER || WHATSAPP_LIVE
        ? 'Verify your mobile number with one WhatsApp message. Each number can belong to only one Vital account.'
        : 'Use a mobile number you have WhatsApp on. Each number can belong to only one Vital account.';

    const onPhoneVerified = async () => {
        await refreshProfile();
        setError('');
        setSuccess('Your number is verified.');
    };

    // What's saved now (not the unsaved form), for the overview and badges.
    const contact = contactVerification(user, session?.user?.email_confirmed_at);
    const savedPoint = usableLocation(user?.location);
    const savedRegion = resolveRegion(user?.state, user?.district);
    const savedWa = waNumber(user?.phone || '');
    const alertsVia: Status = !user?.is_donor
        ? { tone: 'off', text: 'Not a donor' }
        : !user.is_available
            ? { tone: 'off', text: 'Paused' }
            : user.whatsapp_alerts && savedWa
                ? { tone: 'ok', text: 'WhatsApp' }
                : { tone: 'ok', text: 'Email' };
    const overview: { label: string; status: Status; href: string }[] = [
        { label: 'Email', href: '#personal', status: contact.email ? { tone: 'ok', text: 'Verified' } : { tone: 'todo', text: 'Not confirmed' } },
        {
            label: 'Mobile', href: '#phone',
            status: contact.phoneMissing ? { tone: 'todo', text: 'Missing' } : contact.phone ? { tone: 'ok', text: 'Verified' } : { tone: 'todo', text: 'Not verified' },
        },
        {
            label: 'Alert location', href: '#alert-location',
            status: !savedPoint ? { tone: 'todo', text: 'Not set' } : isPrecise(savedPoint) ? { tone: 'ok', text: 'Exact point' } : { tone: 'info', text: 'PIN code area' },
        },
        { label: 'Alerts', href: '#alerts', status: alertsVia },
    ];
    const needsAttention = overview.filter(o => o.status.tone === 'todo').length;

    // Unsaved edits in the main form (blood group, location and push save on their own).
    const dirty = !!lastFilled.current && (Object.keys(editForm) as (keyof typeof editForm)[])
        .some(k => k !== 'blood_group' && editForm[k] !== lastFilled.current![k]);
    const discard = () => { if (lastFilled.current) setEditForm({ ...lastFilled.current, blood_group: editForm.blood_group }); setError(''); setLocationErrors({}); };

    const section = (id: string, icon: React.ElementType, title: string, hint: string, children: React.ReactNode, status?: Status) => {
        const Icon = icon;
        return (
            <section id={id} aria-labelledby={`${id}-title`} className="grid scroll-mt-24 gap-6 border-t border-gray-200 py-8 md:grid-cols-3 md:gap-10">
                <div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-700" aria-hidden="true">
                            <Icon className="h-4 w-4" />
                        </span>
                        <h2 id={`${id}-title`} className="font-medium text-gray-900">{title}</h2>
                        {status && <StatusPill status={status} />}
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-gray-500">{hint}</p>
                </div>
                <div className="space-y-5 md:col-span-2">{children}</div>
            </section>
        );
    };

    const toggle = (checked: boolean, onChange: (v: boolean) => void, title: string, body: React.ReactNode, disabled = false) => (
        <label className={cn('flex items-start justify-between gap-6 rounded-lg border p-4 transition-colors', checked ? 'border-gray-900/20 bg-gray-50' : 'border-gray-200 bg-white', disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer')}>
            <span>
                <span className="flex items-center gap-2 text-gray-900">
                    {title}
                    <span className={cn('text-xs font-medium', checked ? 'text-success-700' : 'text-gray-500')}>{checked ? 'On' : 'Off'}</span>
                </span>
                <span className="mt-0.5 block text-sm text-gray-500">{body}</span>
            </span>
            <span className="relative mt-1 inline-flex shrink-0">
                <input type="checkbox" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} className="peer sr-only" />
                <span className="h-6 w-11 rounded-full bg-gray-300 transition-colors after:absolute after:left-[3px] after:top-[3px] after:h-[18px] after:w-[18px] after:rounded-full after:bg-white after:transition-transform after:content-[''] peer-checked:bg-gray-900 peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-red-600 peer-focus-visible:ring-offset-2" />
            </span>
        </label>
    );

    const savesOnItsOwn = <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600">Saves on its own</span>;

    return (
        <div className="mx-auto max-w-4xl">
            <Link href="/profile" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to profile
            </Link>
            <header className="pb-6 pt-6">
                <h1 className="display text-4xl sm:text-[2.75rem]">Settings</h1>
                <p className="mt-3 max-w-lg text-gray-600">Your details, alerts and privacy, all in one place.</p>
            </header>

            <section aria-labelledby="glance-title" className="mb-8 rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 id="glance-title" className="font-medium text-gray-900">Your account at a glance</h2>
                    <p className={cn('text-sm', needsAttention ? 'text-warning-700' : 'text-success-700')}>
                        {needsAttention ? `${needsAttention} ${needsAttention === 1 ? 'thing needs' : 'things need'} your attention` : 'All set'}
                    </p>
                </div>
                <ul className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {overview.map(o => (
                        <li key={o.label}>
                            <a href={o.href} className={cn('block h-full rounded-lg border p-3 transition-colors hover:border-gray-400', o.status.tone === 'todo' ? 'border-warning-200 bg-warning-50/60' : 'border-gray-200')}>
                                <span className="block text-xs text-gray-500">{o.label}</span>
                                <span className="mt-1.5 block"><StatusPill status={o.status} /></span>
                                {o.status.tone === 'todo' && <span className="mt-2 block text-xs font-medium text-gray-900 underline underline-offset-4">Fix this</span>}
                            </a>
                        </li>
                    ))}
                </ul>
            </section>

            {error && <Alert variant="error" className="mb-6">{error}</Alert>}
            {success && <Alert variant="success" className="mb-6">{success}</Alert>}

            <form onSubmit={handleSave}>
                {section('personal', UserRound, 'Personal details', phoneHint, <>
                    <Input label="Full name" value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} required autoComplete="name" />
                    <div id="phone" className="scroll-mt-24">
                        {user?.phone_released_at && !user.phone && (
                            <Alert variant="warning" className="mb-3">
                                Another Vital account verified the number you had here, so it was removed from this account. Enter your own mobile number.
                            </Alert>
                        )}
                        <Input label="Phone" type="tel" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} required autoComplete="tel" />
                        {!phoneChanged && !!user?.phone_verified_at && (
                            <p className="mt-2"><StatusPill status={{ tone: 'ok', text: 'Verified on WhatsApp' }} /></p>
                        )}
                        {phoneChanged && editForm.phone.trim() && (
                            <p className="mt-2 text-sm text-gray-600">New number: save your changes, then verify it.</p>
                        )}
                        {verifyByMessage && (
                            <div className="mt-3 rounded-lg border border-warning-200 bg-warning-50/60 p-4">
                                <WhatsAppVerify onVerified={onPhoneVerified} size="sm" intro={<p className="text-gray-600">Not verified yet. It takes one WhatsApp message.</p>} />
                            </div>
                        )}
                        {verifyByTemplate && (
                            <p className="mt-1.5 text-sm text-gray-600">
                                Not confirmed yet.{' '}
                                <button type="button" onClick={() => startPhoneVerification(user!.phone).catch(err => setError(err.message))} className="text-gray-900 underline underline-offset-4">
                                    Confirm on WhatsApp
                                </button>
                            </p>
                        )}
                    </div>
                </>, contact.phoneMissing ? { tone: 'todo', text: 'Add your number' } : contact.phone ? { tone: 'ok', text: 'Verified' } : { tone: 'todo', text: 'Verify your number' })}

                {section('location', MapPin, 'Location', `Used to show you donors within ${MATCH_RADIUS_KM} km and to alert you to requests near you.`, <>
                    <StateDistrictSelect
                        state={editForm.state}
                        district={editForm.district}
                        onChange={region => { setEditForm(prev => ({ ...prev, ...region })); setLocationErrors(prev => ({ ...prev, state: undefined, district: undefined })); }}
                        previousState={savedRegion.state ? '' : user?.state}
                        previousDistrict={savedRegion.district ? '' : user?.district}
                        required
                        stateError={locationErrors.state}
                        districtError={locationErrors.district}
                    />
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Input label="Current PIN code" inputMode="numeric" value={editForm.present_zip} onChange={(e) => setEditForm({ ...editForm, present_zip: e.target.value })} required />
                        <Input label="Permanent PIN code" inputMode="numeric" value={editForm.permanent_zip} onChange={(e) => setEditForm({ ...editForm, permanent_zip: e.target.value })} required />
                    </div>
                    <div id="alert-location" className={cn('scroll-mt-24 rounded-lg border p-4', savedPoint ? 'border-gray-200' : 'border-warning-200 bg-warning-50/60')}>
                        <h3 className="mb-1 flex items-center text-[13px] font-medium text-gray-800">Where we alert you from {savesOnItsOwn}</h3>
                        <DonorLocationPicker mode="save" value={user?.location} onSaved={() => { refreshProfile({ silent: true }).catch(() => {}); }} />
                    </div>
                </>, !savedRegion.district ? { tone: 'todo', text: 'Choose your district' } : !savedPoint ? { tone: 'todo', text: 'Set your point' } : isPrecise(savedPoint) ? { tone: 'ok', text: 'Exact point' } : { tone: 'info', text: 'PIN code area' })}

                {user?.is_donor && section('donating', HeartPulse, 'Donating', 'Pause any time, for example while travelling or unwell.', <>
                    {bloodGroupLocked ? (
                    <div id="blood-group" className="scroll-mt-24">
                        <span className="block text-gray-900">Blood group: <strong>{formatBloodGroup(user?.blood_group)}</strong></span>
                        <span className="mt-0.5 block text-sm text-gray-500">
                            You changed it on {new Date(user!.blood_group_changed_at!).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}. It can be changed only once; if it’s still wrong, contact Vital.
                        </span>
                    </div>
                    ) : (
                    <div id="blood-group" className="scroll-mt-24">
                        <span id="settings-blood-group" className="flex items-center text-gray-900">Blood group {savesOnItsOwn}</span>
                        <span className="mt-0.5 block text-sm text-gray-500">Decides which requests you’re alerted to. You can change it <strong>once</strong>, only if it was entered wrongly; we’ll email you a code to confirm.</span>
                        <div className="mt-3 grid grid-cols-4 gap-1.5" role="radiogroup" aria-labelledby="settings-blood-group">
                            {BLOOD_GROUPS.map(g => (
                                <button
                                    key={g}
                                    type="button"
                                    role="radio"
                                    aria-checked={editForm.blood_group === g}
                                    onClick={() => setEditForm({ ...editForm, blood_group: g })}
                                    className={`h-12 rounded-md border font-serif text-2xl transition-colors ${editForm.blood_group === g ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 bg-white text-gray-900 hover:border-gray-400'}`}
                                >
                                    {formatBloodGroup(g)}
                                </button>
                            ))}
                        </div>
                        {bloodGroupPending && (
                            <div className="mt-3 flex flex-wrap items-center gap-3">
                                <Button type="button" variant="ink" size="sm" onClick={startBloodGroupChange} isLoading={bgBusy && !bgCodeOpen}>
                                    Change to {formatBloodGroup(editForm.blood_group)}
                                </Button>
                                <button type="button" className="text-sm text-gray-600 underline underline-offset-4" onClick={() => setEditForm({ ...editForm, blood_group: (user?.blood_group as BloodGroup) || '' })}>
                                    Keep {formatBloodGroup(user?.blood_group)}
                                </button>
                            </div>
                        )}
                    </div>
                    )}
                    {toggle(editForm.is_available, v => setEditForm({ ...editForm, is_available: v }), 'Available to donate',
                        'When off, you get no alerts at all, on any channel, until you turn it back on.')}
                </>, user?.is_available ? { tone: 'ok', text: 'Available' } : { tone: 'off', text: 'Paused' })}

                {user?.is_donor && section('alerts', Bell, 'Alerts', 'How we tell you when someone nearby needs your blood group.', <>
                    <p className={cn('rounded-lg p-4 text-sm leading-relaxed', !editForm.is_available ? 'bg-gray-100 text-gray-700' : 'bg-success-50 text-success-800')}>
                        {!editForm.is_available
                            ? <>Alerts are <strong>paused</strong> because “Available to donate” is off.</>
                            : editForm.whatsapp_alerts && waNumber(editForm.phone)
                                ? <>Alerts reach you on <strong>WhatsApp</strong> at {formatWaNumber(waNumber(editForm.phone)!)}. If a WhatsApp message can’t be sent, we email {user?.email || 'you'} instead.</>
                                : <>Alerts reach you by <strong>email</strong> at {user?.email || 'your email address'}.</>}
                    </p>
                    {toggle(editForm.whatsapp_alerts, v => setEditForm({ ...editForm, whatsapp_alerts: v }), 'WhatsApp alerts',
                        waNumber(editForm.phone)
                            ? <>To {formatWaNumber(waNumber(editForm.phone)!)}. Phone numbers are never shared in WhatsApp. You can also reply STOP there.</>
                            : 'Add a 10-digit Indian mobile number in Personal details first.',
                        !waNumber(editForm.phone) && !editForm.whatsapp_alerts)}
                    <div className="flex items-start justify-between gap-6 rounded-lg border border-gray-200 p-4">
                        <span>
                            <span className="flex items-center text-gray-900">Notifications on this device {savesOnItsOwn}</span>
                            <span className="mt-0.5 block text-sm text-gray-500">Push notifications in this browser. Set it on each device you use.</span>
                        </span>
                        <div className="shrink-0 pt-1"><PushNotificationManager /></div>
                    </div>
                </>, alertsVia)}

                {user?.is_donor && section('privacy', ShieldCheck, 'Privacy', 'Your contact details are never on your card.', <>
                    {toggle(editForm.is_public_profile, v => setEditForm({ ...editForm, is_public_profile: v }), 'Public donor card',
                        'Anyone with your link can see your first name, blood group and donation count. Needed to appear on the Top inviters list.')}
                </>, editForm.is_public_profile ? { tone: 'info', text: 'Card is public' } : { tone: 'off', text: 'Card is private' })}

                <div className={cn('sticky bottom-0 z-10 flex flex-col gap-3 border-t py-4 sm:flex-row sm:items-center sm:justify-between', dirty ? 'border-gray-900/20 bg-white shadow-[0_-4px_16px_rgba(0,0,0,0.06)]' : 'border-gray-200 bg-white/95')}>
                    <p role="status" className={cn('flex items-center gap-2 text-sm', dirty ? 'font-medium text-gray-900' : 'text-gray-500')}>
                        {dirty
                            ? <><AlertCircle className="h-4 w-4 text-warning-600" aria-hidden="true" /> You have unsaved changes</>
                            : <><CheckCircle2 className="h-4 w-4 text-success-600" aria-hidden="true" /> All changes saved</>}
                    </p>
                    <div className="flex flex-col-reverse gap-2 sm:flex-row">
                        {dirty
                            ? <Button type="button" variant="ghost" onClick={discard}>Discard</Button>
                            : <Button type="button" variant="ghost" onClick={() => router.push('/profile')}>Back to profile</Button>}
                        <Button type="submit" variant="ink" size="lg" isLoading={isLoading} disabled={!dirty}>Save changes</Button>
                    </div>
                </div>
            </form>

            {section('password', KeyRound, 'Password', 'How you sign in to Vital.', <SecuritySettings />)}

            <Modal
                isOpen={bgCodeOpen}
                onClose={() => { setBgCodeOpen(false); setBgCode(''); setBgError(''); }}
                title="Confirm your blood group change"
            >
                <form onSubmit={confirmBloodGroupChange} className="space-y-5">
                    <p className="leading-relaxed text-gray-600">
                        We emailed a 6-digit code to <span className="text-gray-900">{bgSentTo}</span>. Enter it to change your blood group
                        from <strong>{formatBloodGroup(user?.blood_group)}</strong> to <strong>{formatBloodGroup(editForm.blood_group)}</strong>.
                        This is your one change.
                    </p>
                    {bgError && <Alert variant="error">{bgError}</Alert>}
                    <Input
                        label="Code"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        value={bgCode}
                        onChange={(e) => setBgCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="000000"
                        className="h-14 text-center font-mono text-2xl tracking-[0.4em]"
                    />
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <Button type="button" variant="secondary" onClick={() => { setBgCodeOpen(false); setBgCode(''); }}>Cancel</Button>
                        <Button type="submit" variant="ink" isLoading={bgBusy} disabled={bgCode.length < 6}>Confirm change</Button>
                    </div>
                </form>
            </Modal>

            <Modal
                isOpen={isVerifying}
                onClose={() => { setIsVerifying(false); setIsLoading(false); setOtp(''); }}
                title="Confirm your number"
            >
                <form onSubmit={handleVerifyOtp} className="space-y-5">
                    <p className="leading-relaxed text-gray-600">
                        We sent a 6-digit code on WhatsApp to <span className="text-gray-900">{pendingPhone}</span>. It works for 10 minutes.
                        {' '}<button type="button" onClick={resendCode} className="text-gray-900 underline underline-offset-4">Send a new code</button>
                    </p>
                    <Input
                        label="Code"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="000000"
                        required
                        className="h-14 text-center font-mono text-2xl tracking-[0.4em]"
                    />
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <Button type="button" variant="secondary" onClick={() => { setIsVerifying(false); setIsLoading(false); setOtp(''); }}>
                            Cancel
                        </Button>
                        <Button type="submit" variant="ink" isLoading={isLoading} disabled={otp.length < 6}>Verify and save</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}

type Status = { tone: 'ok' | 'todo' | 'info' | 'off'; text: string };

/** A status in words with an icon, so it never relies on colour alone. */
function StatusPill({ status }: { status: Status }) {
    const Icon = status.tone === 'ok' ? CheckCircle2 : status.tone === 'todo' ? AlertCircle : status.tone === 'off' ? PauseCircle : MapPin;
    return (
        <span className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
            status.tone === 'ok' && 'bg-success-50 text-success-700 ring-success-200',
            status.tone === 'todo' && 'bg-warning-50 text-warning-800 ring-warning-200',
            status.tone === 'info' && 'bg-gray-100 text-gray-700 ring-gray-200',
            status.tone === 'off' && 'bg-gray-100 text-gray-600 ring-gray-200',
        )}>
            <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {status.text}
        </span>
    );
}
