"use client";

import { authedFetch } from '@/lib/api';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthFrame, authLinkClass } from '@/components/auth/AuthFrame';
import { GoogleButton, OrDivider, friendlyAuthError } from '@/components/auth/GoogleButton';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { PLATFORM_DISCLAIMER, consentStamp } from '@/lib/legal';

export default function RegisterPage() {
    const router = useRouter();
    const { signUp } = useAuth();
    const [formData, setFormData] = useState({
        email: '',
        password: '',
    });
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [agreed, setAgreed] = useState(false);
    const consentError = 'Tick the box to agree to the Terms and Privacy notice before continuing.';

    const handleGoogleSignUp = async () => {
        setError('');
        if (!agreed) {
            setFieldErrors({ consent: consentError });
            return;
        }
        setFieldErrors({});
        setIsGoogleLoading(true);
        try {
            // OAuth can't carry user metadata, so remember the consent locally;
            // complete-registration records it against the account.
            try { localStorage.setItem('pendingConsent', JSON.stringify(consentStamp())); } catch { /* storage unavailable */ }
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: `${window.location.origin}/auth/callback` },
            });
            if (error) throw error;
        } catch (err: any) {
            setError(friendlyAuthError(err?.message));
            setIsGoogleLoading(false);
        }
    };

    const validateForm = () => {
        const errors: Record<string, string> = {};

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!formData.email) {
            errors.email = 'Email is required';
        } else if (!emailRegex.test(formData.email)) {
            errors.email = 'Please enter a valid email address';
        }

        // Password validation
        if (!formData.password) {
            errors.password = 'Password is required';
        } else if (formData.password.length < 8) {
            errors.password = 'Use at least 8 characters.';
        }

        if (!agreed) errors.consent = consentError;

        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setFieldErrors({});

        if (!validateForm()) {
            return;
        }

        setIsLoading(true);

        try {
            const consent = consentStamp();
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    data: {
                        registration_completed: false,
                        // Recorded server-side in auth.users at the moment of signup.
                        ...consent,
                    },
                    emailRedirectTo: `${window.location.origin}/complete-registration`
                }
            });

            if (authError) throw authError;

            if (!authData.user) {
                throw new Error('Failed to create account');
            }

            // A database trigger creates the profile row on signup; stamp the
            // consent on it too when we already have a session (no email confirmation).
            if (authData.session) {
                await supabase.from('profiles').update(consent).eq('id', authData.user.id); // best effort; metadata above is the record
            }

            // Store basic registration data
            localStorage.setItem('pendingRegistration', JSON.stringify({
                userId: authData.user.id,
                email: formData.email
            }));

            // Trigger Welcome Email in background
            // Welcome email goes to the signed-in user's own address (server-side).
            authedFetch('/api/notify/welcome', { method: 'POST' }).catch(() => {});

            // Direct onboarding: auto-login logic (handled by supabase client usually if confirm is off)
            // Redirect to completion page immediately
            router.push('/complete-registration');

        } catch (err: any) {
            console.error('Registration error');
            setError(friendlyAuthError(err?.message));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AuthFrame
            title="Register as a donor"
            subtitle="First create an account. On the next screen you will add your blood group and where you live. It takes about two minutes."
            footer={<>Already registered? <Link href="/login" className={authLinkClass}>Sign in</Link></>}
        >
            {error && <Alert variant="error" className="mb-6">{error}</Alert>}

            <div className="mb-6">
                <label className="flex cursor-pointer items-start gap-3">
                    <input
                        type="checkbox"
                        checked={agreed}
                        onChange={(e) => { setAgreed(e.target.checked); if (e.target.checked) setFieldErrors(({ consent: _c, ...rest }) => rest); }}
                        aria-invalid={!!fieldErrors.consent}
                        aria-describedby={fieldErrors.consent ? 'consent-error' : undefined}
                        className="mt-1 h-4 w-4 shrink-0 rounded-[4px] border-gray-400 accent-gray-900"
                    />
                    <span className="text-sm leading-relaxed text-gray-600">
                        I agree to the <Link href="/terms" target="_blank" className={authLinkClass}>Terms</Link> and have read the
                        {' '}<Link href="/privacy" target="_blank" className={authLinkClass}>Privacy notice</Link>.
                    </span>
                </label>
                {fieldErrors.consent && <p id="consent-error" className="ml-7 mt-1.5 text-[13px] text-red-700">{fieldErrors.consent}</p>}
            </div>

            <GoogleButton onClick={handleGoogleSignUp} isLoading={isGoogleLoading} />
            <OrDivider />

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <Input
                    label="Email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    error={fieldErrors.email}
                />
                <Input
                    label="Password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    autoComplete="new-password"
                    minLength={8}
                    helperText="At least 8 characters."
                    error={fieldErrors.password}
                />
                <Button type="submit" variant="primary" size="lg" className="w-full !mt-6" isLoading={isLoading}>
                    Create account
                </Button>
            </form>

            <p className="mt-6 text-[13px] leading-relaxed text-gray-500">
                {PLATFORM_DISCLAIMER} Any arrangement is between you and the other person, at your own discretion.
            </p>
        </AuthFrame>
    );
}
