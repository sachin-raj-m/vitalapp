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

    const handleGoogleSignUp = async () => {
        setIsGoogleLoading(true);
        setError('');
        try {
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
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    data: {
                        registration_completed: false
                    },
                    emailRedirectTo: `${window.location.origin}/complete-registration`
                }
            });

            if (authError) throw authError;

            if (!authData.user) {
                throw new Error('Failed to create account');
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
                By creating an account you agree to the <Link href="/terms" className={authLinkClass}>Terms</Link> and
                {' '}<Link href="/privacy" className={authLinkClass}>Privacy notice</Link>. Vital only connects people. It does not
                arrange, verify or guarantee donations, and is not involved in any payment. Any arrangement is between
                you and the other person, at your own discretion.
            </p>
        </AuthFrame>
    );
}
