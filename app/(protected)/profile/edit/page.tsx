"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { useAuth } from '@/context/AuthContext';
import { authedFetch } from '@/lib/api';
import { ArrowLeft } from 'lucide-react';
import { SecuritySettings } from '@/app/(protected)/profile/SecuritySettings';
import { PushNotificationManager } from '@/components/PushNotificationManager';
import { formatWaNumber, waNumber } from '@/lib/phone';
import { WHATSAPP_LIVE } from '@/lib/features';

export default function ProfileEditPage() {
    const router = useRouter();
    const { user, updateProfile, refreshProfile } = useAuth();
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const [editForm, setEditForm] = useState({
        full_name: '',
        phone: '',
        is_available: false,
        permanent_zip: '',
        present_zip: '',
        is_public_profile: false,
        whatsapp_alerts: false,
    });

    // OTP Verification State
    const [isVerifying, setIsVerifying] = useState(false);
    const [otp, setOtp] = useState('');
    const [pendingPhone, setPendingPhone] = useState('');

    useEffect(() => {
        if (user) {
            setEditForm({
                full_name: user.full_name || '',
                phone: user.phone || '',
                is_available: user.is_available || false,
                permanent_zip: user.permanent_zip || '',
                present_zip: user.present_zip || '',
                is_public_profile: user.is_public_profile || false,
                whatsapp_alerts: user.whatsapp_alerts || false,
            });
        }
    }, [user]);

    // After a save that changed the PIN code, re-derive the map position on the
    // server. Fire-and-forget: a failure only means ranking by PIN area.
    const refreshLocationIfPinChanged = (previousZip: string | null | undefined) => {
        if ((previousZip || '').trim() === editForm.present_zip.trim()) return;
        authedFetch('/api/profile/location', { method: 'POST', keepalive: true }).catch(() => {});
    };

    // Everything except the phone number, which has its own flow below.
    const saveOtherFields = async () => {
        await updateProfile({
            full_name: editForm.full_name,
            is_available: editForm.is_available,
            permanent_zip: editForm.permanent_zip,
            present_zip: editForm.present_zip,
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

    const phoneChanged = editForm.phone.trim() !== (user?.phone || '').trim();
    const needsVerify = WHATSAPP_LIVE && !phoneChanged && !!user?.phone && !user?.phone_verified_at && !!waNumber(user.phone);

    const section = (title: string, hint: string, children: React.ReactNode) => (
        <section className="grid gap-6 border-t border-gray-200 py-8 md:grid-cols-3 md:gap-10">
            <div>
                <h2 className="font-medium text-gray-900">{title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-gray-500">{hint}</p>
            </div>
            <div className="space-y-4 md:col-span-2">{children}</div>
        </section>
    );

    const toggle = (checked: boolean, onChange: (v: boolean) => void, title: string, body: React.ReactNode) => (
        <label className="flex cursor-pointer items-start justify-between gap-6">
            <span>
                <span className="block text-gray-900">{title}</span>
                <span className="mt-0.5 block text-sm text-gray-500">{body}</span>
            </span>
            <span className="relative mt-1 inline-flex shrink-0">
                <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="peer sr-only" />
                <span className="h-6 w-11 rounded-full bg-gray-300 transition-colors after:absolute after:left-[3px] after:top-[3px] after:h-[18px] after:w-[18px] after:rounded-full after:bg-white after:transition-transform after:content-[''] peer-checked:bg-gray-900 peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-red-600 peer-focus-visible:ring-offset-2" />
            </span>
        </label>
    );

    return (
        <div className="mx-auto max-w-4xl">
            <Link href="/profile" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to profile
            </Link>
            <header className="pb-8 pt-6">
                <h1 className="display text-4xl sm:text-[2.75rem]">Settings</h1>
                <p className="mt-3 max-w-lg text-gray-600">Your details, alerts and privacy, all in one place.</p>
            </header>

            {error && <Alert variant="error" className="mb-6">{error}</Alert>}
            {success && <Alert variant="success" className="mb-6">{success}</Alert>}

            <form onSubmit={handleSave}>
                {section('Personal details', WHATSAPP_LIVE ? 'A new phone number is confirmed with a code sent to it on WhatsApp.' : 'Use a mobile number you have WhatsApp on.', <>
                    <Input label="Full name" value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} required autoComplete="name" />
                    <div>
                        <Input label="Phone" type="tel" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} required autoComplete="tel" />
                        {needsVerify && (
                            <p className="mt-1.5 text-sm text-gray-600">
                                Not confirmed yet.{' '}
                                <button type="button" onClick={() => startPhoneVerification(user!.phone).catch(err => setError(err.message))} className="text-gray-900 underline underline-offset-4">
                                    Confirm on WhatsApp
                                </button>
                            </p>
                        )}
                    </div>
                </>)}

                {section('Location', 'Used to show you donors and requests nearby.', <div className="grid gap-4 sm:grid-cols-2">
                    <Input label="Current PIN code" inputMode="numeric" value={editForm.present_zip} onChange={(e) => setEditForm({ ...editForm, present_zip: e.target.value })} required />
                    <Input label="Permanent PIN code" inputMode="numeric" value={editForm.permanent_zip} onChange={(e) => setEditForm({ ...editForm, permanent_zip: e.target.value })} required />
                </div>)}

                {user?.is_donor && section('Donating', 'Pause any time, for example while travelling or unwell.', <>
                    {toggle(editForm.is_available, v => setEditForm({ ...editForm, is_available: v }), 'Available to donate',
                        'When off, you get no alerts at all, on any channel, until you turn it back on.')}
                </>)}

                {user?.is_donor && section('Alerts', 'How we tell you when someone nearby needs your blood group.', <div className="space-y-6">
                    {toggle(editForm.whatsapp_alerts, v => setEditForm({ ...editForm, whatsapp_alerts: v }), 'WhatsApp',
                        waNumber(editForm.phone)
                            ? <>Messages to {formatWaNumber(waNumber(editForm.phone)!)}. Phone numbers are never shared in WhatsApp. You can also reply STOP there.</>
                            : 'Needs a 10-digit Indian mobile number in Personal details.')}
                    <div className="flex items-start justify-between gap-6">
                        <span>
                            <span className="block text-gray-900">Notifications on this device</span>
                            <span className="mt-0.5 block text-sm text-gray-500">Push notifications in this browser. Applies straight away; set it on each device you use.</span>
                        </span>
                        <div className="shrink-0 pt-1"><PushNotificationManager /></div>
                    </div>
                    {!editForm.whatsapp_alerts && <p className="text-sm text-gray-500">Without WhatsApp, alerts come by email.</p>}
                </div>)}

                {user?.is_donor && section('Privacy', 'Your contact details are never on your card.', <>
                    {toggle(editForm.is_public_profile, v => setEditForm({ ...editForm, is_public_profile: v }), 'Public donor card',
                        'Anyone with your link can see your first name, blood group and donation count. Needed to appear on the Top inviters list.')}
                </>)}

                <div className="flex flex-col-reverse gap-2 border-t border-gray-200 py-6 sm:flex-row sm:justify-end">
                    <Button type="button" variant="ghost" onClick={() => router.push('/profile')}>Cancel</Button>
                    <Button type="submit" variant="ink" size="lg" isLoading={isLoading}>Save changes</Button>
                </div>
            </form>

            <section className="grid gap-6 border-t border-gray-200 py-8 md:grid-cols-3 md:gap-10">
                <div>
                    <h2 className="font-medium text-gray-900">Password</h2>
                    <p className="mt-1 text-sm leading-relaxed text-gray-500">How you sign in to Vital.</p>
                </div>
                <div className="md:col-span-2"><SecuritySettings /></div>
            </section>

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
