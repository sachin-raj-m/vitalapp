"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft } from 'lucide-react';
import { SecuritySettings } from '@/app/(protected)/profile/SecuritySettings';

export default function ProfileEditPage() {
    const router = useRouter();
    const { user, updateProfile } = useAuth();
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const [editForm, setEditForm] = useState({
        full_name: '',
        phone: '',
        is_available: false,
        permanent_zip: '',
        present_zip: '',
        is_public_profile: false
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
                is_public_profile: user.is_public_profile || false
            });
        }
    }, [user]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setError('');
        setSuccess('');
        setIsLoading(true);

        try {


            // Check if phone number changed
            if (editForm.phone !== user?.phone) {


                // Initiate Phone Verification
                const { error: authError } = await supabase.auth.updateUser({
                    phone: editForm.phone
                });

                if (authError) {
                    console.error('OTP send error:', authError);
                    throw authError;
                }


                setPendingPhone(editForm.phone);
                setIsVerifying(true);
                setIsLoading(false);
                setSuccess(`Verification code sent to ${editForm.phone}`);
                return;
            }

            // Normal update without phone change
            await updateProfile({
                full_name: editForm.full_name,
                is_available: editForm.is_available,
                permanent_zip: editForm.permanent_zip,
                present_zip: editForm.present_zip,
                is_public_profile: editForm.is_public_profile
                // phone is not updated here directly if not changed
            });
            setSuccess('Saved.');
            setTimeout(() => router.push('/profile'), 1500);
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
            const { data, error: verifyError } = await supabase.auth.verifyOtp({
                phone: pendingPhone,
                token: otp,
                type: 'phone_change'
            });

            if (verifyError) throw verifyError;

            // Update remaining profile details
            await updateProfile({
                full_name: editForm.full_name,
                phone: pendingPhone,
                is_available: editForm.is_available,
                permanent_zip: editForm.permanent_zip,
                present_zip: editForm.present_zip,
                is_public_profile: editForm.is_public_profile
            });

            setSuccess('Phone number verified successfully!');
            setIsVerifying(false);

            // Redirect after brief delay to show success message
            setTimeout(() => router.push('/profile'), 1500);
        } catch (err: any) {
            setError(err.message || 'Invalid verification code');
            setIsLoading(false);
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

    const toggle = (checked: boolean, onChange: (v: boolean) => void, title: string, body: string) => (
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
                <ArrowLeft className="h-3.5 w-3.5" /> Profile
            </Link>
            <header className="pb-8 pt-6">
                <h1 className="display text-5xl leading-none">Edit profile</h1>
            </header>

            {error && <Alert variant="error" className="mb-6">{error}</Alert>}
            {success && <Alert variant="success" className="mb-6">{success}</Alert>}

            <form onSubmit={handleSave}>
                {section('You', 'Changing your phone number sends a code to the new number to confirm it.', <>
                    <Input label="Full name" value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} required autoComplete="name" />
                    <Input label="Phone" type="tel" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} required autoComplete="tel" />
                </>)}

                {section('Location', 'Used to show you donors and requests nearby.', <div className="grid gap-4 sm:grid-cols-2">
                    <Input label="Current PIN code" inputMode="numeric" value={editForm.present_zip} onChange={(e) => setEditForm({ ...editForm, present_zip: e.target.value })} required />
                    <Input label="Permanent PIN code" inputMode="numeric" value={editForm.permanent_zip} onChange={(e) => setEditForm({ ...editForm, permanent_zip: e.target.value })} required />
                </div>)}

                {section('Availability', 'You can pause yourself any time, for travel, illness or anything else.', <div className="space-y-5">
                    {toggle(editForm.is_available, v => setEditForm({ ...editForm, is_available: v }), 'Available to donate', 'Turn off to stop getting requests for a while.')}
                    {toggle(editForm.is_public_profile, v => setEditForm({ ...editForm, is_public_profile: v }), 'Public donor card', 'Anyone with your link can see your first name, blood group and donation count.')}
                </div>)}

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
                title="Confirm your new number"
            >
                <form onSubmit={handleVerifyOtp} className="space-y-5">
                    <p className="leading-relaxed text-gray-600">
                        We sent a 6-digit code to <span className="text-gray-900">{pendingPhone}</span>.
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
