"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input, Select } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { BLOOD_GROUPS, formatBloodGroup } from '@/lib/blood-compatibility';
import type { BloodGroup } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { isRegistrationComplete } from '@/lib/auth-helpers';
import { addDays } from 'date-fns';
import { toast } from 'sonner';
import Link from 'next/link';
import { PRIVACY_VERSION } from '@/lib/legal';

interface PendingRegistration {
    userId: string;
    email: string;
    phone?: string;
}

interface CompleteRegistrationForm {
    fullName: string;
    dob: string;
    gender: string;
    phone: string;
    bloodGroup: BloodGroup | '';
    state: string;
    city: string;
    district: string;
    permanentZip: string;
    presentZip: string;
    lastDonationDate: string;
    willingTovelKm: number;
    availability: string[];
    hasConditions: boolean;
    consent: boolean;
}

export default function CompleteRegistration() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [error, setError] = useState<string>('');
    const [status, setStatus] = useState<string>('loading');
    const [progress, setProgress] = useState<number>(0);
    const [pendingData, setPendingData] = useState<PendingRegistration | null>(null);
    const [formData, setFormData] = useState<CompleteRegistrationForm>({
        fullName: '',
        dob: '',
        gender: '',
        phone: '',
        bloodGroup: '',
        state: '',
        city: '',
        district: '',
        permanentZip: '',
        presentZip: '',
        lastDonationDate: '',
        willingTovelKm: 10,
        availability: ['Weekends'],
        hasConditions: false,
        consent: false
    });
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [nbtcEligible, setNbtcEligible] = useState<boolean>(true);

    useEffect(() => {
        const init = async () => {
            try {
                if (!user) {
                    router.push('/login');
                    return;
                }

                const isComplete = await isRegistrationComplete(user.id);
                if (isComplete) {
                    router.push('/dashboard');
                    return;
                }

                const storedData = localStorage.getItem('pendingRegistration');
                if (!storedData) {
                    setError('Registration data not found. Please register again.');
                    router.push('/register');
                    return;
                }

                try {
                    const data = JSON.parse(storedData);
                    if (data.userId !== user.id) throw new Error('User ID mismatch');

                    setPendingData(data);
                    if (data.phone) {
                        setFormData(prev => ({ ...prev, phone: data.phone }));
                    }
                    setStatus('form');
                } catch (err) {
                    console.error('Error processing stored data:', err);
                    throw new Error('Invalid registration data');
                }
            } catch (err: any) {
                console.error('Initialization error:', err);
                setError(err.message || 'Failed to load registration data');
                router.push('/register');
            }
        };

        // Wait for auth to settle; `user` is null while loading, which would
        // otherwise bounce a freshly registered user to /login.
        if (!authLoading) init();
    }, [router, user, authLoading]);

    const validateForm = () => {
        const errors: Record<string, string> = {};

        if (!formData.fullName.trim()) errors.fullName = 'Full name is required';
        if (!formData.phone.trim()) errors.phone = 'Phone number is required';
        if (!formData.dob) errors.dob = 'Date of birth is required';
        if (!formData.gender) errors.gender = 'Gender is required';
        if (!formData.bloodGroup) errors.bloodGroup = 'Blood Group is required';
        if (!formData.state.trim()) errors.state = 'State is required';
        if (!formData.city.trim()) errors.city = 'City is required';
        if (!formData.district.trim()) errors.district = 'District is required';
        if (!formData.permanentZip.trim()) errors.permanentZip = 'Permanent Zip Code is required';
        if (!formData.presentZip.trim()) errors.presentZip = 'Present Zip Code is required';

        if (formData.dob) {
            const age = new Date().getFullYear() - new Date(formData.dob).getFullYear();
            if (age < 18) errors.dob = 'You must be at least 18 years old to register as a donor.';
        }

        if (!formData.consent) errors.consent = 'Please agree to the Privacy notice to continue.';

        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateForm() || !pendingData) return;

        setStatus('creating_profile');
        setProgress(50);

        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) throw sessionError;
            if (!session || session.user.id !== pendingData.userId) {
                setError('Session invalid. Please sign in again.');
                router.push('/login');
                return;
            }

            // Create/Update Profile
            const { error: profileError } = await supabase
                .from('profiles')
                .upsert(
                    {
                        id: session.user.id,
                        email: pendingData.email,
                        full_name: formData.fullName,
                        phone: formData.phone,
                        dob: formData.dob,
                        gender: formData.gender,
                        blood_group: formData.bloodGroup || null,
                        city: formData.city,
                        district: formData.district,
                        state: formData.state,
                        permanent_zip: formData.permanentZip,
                        present_zip: formData.presentZip,
                        availability: formData.availability,
                        has_medical_conditions: formData.hasConditions,
                        consent_agreed: true,
                        consent_at: new Date().toISOString(),
                        consent_version: PRIVACY_VERSION,
                        next_eligible_date: (() => {
                            if (!nbtcEligible) return null; // Permanent deferral
                            if (!formData.lastDonationDate) return new Date().toISOString();

                            const lastDate = new Date(formData.lastDonationDate);
                            const daysToAdd = formData.gender === 'Female' ? 120 : 90;
                            return addDays(lastDate, daysToAdd).toISOString();
                        })(),
                        // If NBTC ineligible, force is_donor to false (Volunteer Only)
                        is_donor: nbtcEligible,
                        is_available: nbtcEligible
                    },
                    { onConflict: 'id' }
                );

            if (profileError) throw profileError;

            setProgress(90);
            setStatus('finalizing');

            const { error: updateError } = await supabase.auth.updateUser({
                data: {
                    registration_completed: true,
                    phone: formData.phone,
                    full_name: formData.fullName
                }
            });

            if (updateError) throw updateError;

            setProgress(100);
            setStatus('completed');
            localStorage.removeItem('pendingRegistration');
            toast.success('You’re on the network', {
                description: 'We’ll alert you when someone nearby needs your blood group.'
            });
            setTimeout(() => router.push('/dashboard'), 1500);

        } catch (err: any) {
            console.error('Registration completion error:', err);
            setError(err.message || 'Failed to complete registration');
            setStatus('error');
        }
    };

    const set = <K extends keyof CompleteRegistrationForm>(key: K, value: CompleteRegistrationForm[K]) =>
        setFormData(prev => ({ ...prev, [key]: value }));

    const checkbox = (checked: boolean, onChange: (v: boolean) => void, title: string, body: React.ReactNode, error?: string) => (
        <div>
            <label className="flex cursor-pointer items-start gap-3">
                <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="mt-1 h-4 w-4 shrink-0 rounded-[4px] border-gray-400 accent-gray-900" />
                <span className="text-sm leading-relaxed text-gray-600">
                    <span className="block font-medium text-gray-900">{title}</span>
                    {body}
                </span>
            </label>
            {error && <p className="ml-7 mt-1.5 text-[13px] text-red-700">{error}</p>}
        </div>
    );

    const section = (n: string, title: string, hint: string, children: React.ReactNode) => (
        <section className="grid gap-6 border-t border-gray-200 py-8 md:grid-cols-3 md:gap-10">
            <div>
                <p className="font-mono text-xs text-red-600">{n}</p>
                <h2 className="mt-2 font-medium text-gray-900">{title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-gray-500">{hint}</p>
            </div>
            <div className="space-y-4 md:col-span-2">{children}</div>
        </section>
    );

    if (status === 'loading' || status === 'creating_profile' || status === 'finalizing' || status === 'completed') {
        const label = status === 'loading' ? 'One moment…' : status === 'completed' ? 'You’re in. Taking you to your dashboard…' : 'Setting up your profile…';
        return (
            <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-5">
                <p className="eyebrow">{status === 'completed' ? 'Done' : 'Please wait'}</p>
                <p className="display mt-3 text-4xl leading-tight">{label}</p>
                {status !== 'loading' && (
                    <div className="mt-8 h-1 overflow-hidden rounded-full bg-gray-200">
                        <div className="h-full rounded-full bg-red-600 transition-[width] duration-500" style={{ width: `${progress}%` }} />
                    </div>
                )}
            </div>
        );
    }

    if (status === 'error') {
        return (
            <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-5">
                <p className="font-mono text-xs text-red-600">Error</p>
                <p className="display mt-3 text-4xl leading-tight">That didn’t save.</p>
                <p className="mt-4 text-gray-600">{error}</p>
                <Button variant="ink" className="mt-8 self-start" onClick={() => setStatus('form')}>Back to the form</Button>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
            <header className="pb-8">
                <p className="eyebrow">Step 2 of 2</p>
                <h1 className="display mt-3 text-5xl leading-none">A little about <em>you.</em></h1>
                <p className="mt-4 max-w-xl leading-relaxed text-gray-600">
                    This is what lets Vital alert you only when your blood group is needed in your city, and not otherwise.
                </p>
            </header>

            {error && <Alert variant="error" className="mb-6">{error}</Alert>}

            <form onSubmit={handleSubmit} noValidate>
                {section('01', 'You', 'Your name and number are only shared with a family after you offer to help them.', <>
                    <Input label="Full name" value={formData.fullName} onChange={e => set('fullName', e.target.value)} required autoComplete="name" error={fieldErrors.fullName} />
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Input label="Date of birth" type="date" value={formData.dob} onChange={e => set('dob', e.target.value)} required error={fieldErrors.dob} />
                        <Select
                            label="Gender"
                            value={formData.gender}
                            onChange={e => set('gender', e.target.value)}
                            options={[
                                { value: '', label: 'Select' },
                                { value: 'Male', label: 'Male' },
                                { value: 'Female', label: 'Female' },
                                { value: 'Other', label: 'Other' },
                            ]}
                            required
                            error={fieldErrors.gender}
                        />
                    </div>
                    <Input label="Mobile number" type="tel" value={formData.phone} onChange={e => set('phone', e.target.value)} required autoComplete="tel" placeholder="+91 98765 43210" error={fieldErrors.phone} />
                </>)}

                {section('02', 'Your blood', 'If you’re not sure, it’s on any blood test report, or a blood bank can tell you for free.', <>
                    <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Blood group">
                        {BLOOD_GROUPS.map(g => (
                            <button
                                key={g}
                                type="button"
                                role="radio"
                                aria-checked={formData.bloodGroup === g}
                                onClick={() => set('bloodGroup', g)}
                                className={`h-14 rounded-md border font-serif text-3xl transition-colors ${formData.bloodGroup === g ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 bg-white text-gray-900 hover:border-gray-400'}`}
                            >
                                {formatBloodGroup(g)}
                            </button>
                        ))}
                    </div>
                    {fieldErrors.bloodGroup && <p className="text-[13px] text-red-700">{fieldErrors.bloodGroup}</p>}
                    <Input
                        label="Last donated (if you have before)"
                        type="date"
                        value={formData.lastDonationDate}
                        max={new Date().toISOString().split('T')[0]}
                        onChange={e => set('lastDonationDate', e.target.value)}
                        helperText="Used to work out when you can donate next."
                    />
                </>)}

                {section('03', 'Where you are', 'Requests are matched by city, so this decides which alerts you get.', <>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Input label="City" value={formData.city} onChange={e => set('city', e.target.value)} required placeholder="e.g. Kochi" error={fieldErrors.city} />
                        <Input label="District" value={formData.district} onChange={e => set('district', e.target.value)} required placeholder="e.g. Ernakulam" error={fieldErrors.district} />
                    </div>
                    <Input label="State" value={formData.state} onChange={e => set('state', e.target.value)} required placeholder="e.g. Kerala" error={fieldErrors.state} />
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Input label="Current PIN code" inputMode="numeric" value={formData.presentZip} onChange={e => set('presentZip', e.target.value)} required placeholder="e.g. 682011" error={fieldErrors.presentZip} />
                        <Input label="Permanent PIN code" inputMode="numeric" value={formData.permanentZip} onChange={e => set('permanentZip', e.target.value)} required placeholder="e.g. 682011" error={fieldErrors.permanentZip} />
                    </div>
                    <div>
                        <p className="mb-2 text-[13px] font-medium text-gray-800">Usually free on</p>
                        <div className="flex gap-1.5">
                            {['Weekdays', 'Weekends'].map(day => {
                                const on = formData.availability.includes(day);
                                return (
                                    <button
                                        key={day}
                                        type="button"
                                        aria-pressed={on}
                                        onClick={() => set('availability', on ? formData.availability.filter(d => d !== day) : [...formData.availability, day])}
                                        className={`h-9 rounded-full border px-4 text-sm transition-colors ${on ? 'border-gray-900 bg-gray-900 text-gray-50' : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'}`}
                                    >
                                        {day}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </>)}

                {section('04', 'Confirm', 'Both are required to join as a donor.', <>
                    {checkbox(
                        !formData.hasConditions,
                        v => set('hasConditions', !v),
                        'I’m fit to donate',
                        'I don’t have a serious chronic illness, haven’t had recent major surgery, and don’t have any other condition that rules out donating.',
                    )}
                    {checkbox(
                        formData.consent,
                        v => set('consent', v),
                        'I agree to share my details for donation',
                        <>
                            My name and mobile are shared with a family only when I offer to help them. I’ve read the{' '}
                            <Link href="/privacy" target="_blank" className="text-gray-900 underline decoration-gray-300 underline-offset-4">Privacy notice</Link>
                            {' '}and can withdraw by deleting my account.
                        </>,
                        fieldErrors.consent,
                    )}
                </>)}

                <div className="flex justify-end border-t border-gray-200 pt-6">
                    <Button type="submit" variant="primary" size="lg">
                        Join the network
                    </Button>
                </div>
            </form>
        </div>
    );
}
