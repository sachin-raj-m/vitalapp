"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthFrame, authLinkClass } from '@/components/auth/AuthFrame';
import { GoogleButton, OrDivider, friendlyAuthError } from '@/components/auth/GoogleButton';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { isRegistrationComplete } from '@/lib/auth-helpers';
import { safeInternalPath } from '@/lib/site';

export default function LoginPage() {
    const router = useRouter();
    const { signIn, user } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);

    useEffect(() => {
        if (!user) return;

        const params = new URLSearchParams(window.location.search);
        const redirect = safeInternalPath(params.get('redirect') || params.get('from'), '');

        const route = async () => {
            // Requesting blood doesn't require a full donor profile.
            if (redirect.startsWith('/requests')) {
                router.push(redirect);
                return;
            }

            const isComplete = await isRegistrationComplete(user.id).catch(() => false);
            if (isComplete) {
                router.push(redirect || '/dashboard');
                return;
            }

            try {
                localStorage.setItem('pendingRegistration', JSON.stringify({
                    userId: user.id,
                    email: user.email,
                    phone: user.phone || '',
                }));
            } catch { /* storage blocked */ }
            router.push('/complete-registration');
        };

        route();
    }, [user, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            await signIn(email, password);
            // The navigation will be handled by the useEffect above
        } catch (err: any) {
            setError(friendlyAuthError(err?.message));
            setIsLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setIsGoogleLoading(true);
        setError('');
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/auth/callback`,
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'consent',
                    },
                },
            });

            if (error) {
                throw error;
            }
        } catch (err: any) {
            setError(friendlyAuthError(err?.message));
            setIsGoogleLoading(false);
        }
    };

    return (
        <AuthFrame
            title="Sign in"
            subtitle="Use the email address you registered with, or continue with Google."
            footer={
                <div className="flex flex-wrap justify-between gap-3">
                    <span>
                        New to Vital? <Link href="/register" className={authLinkClass}>Create an account</Link>
                    </span>
                    <Link href="/forgot-password" className="text-gray-500 hover:text-gray-900">
                        Forgot password?
                    </Link>
                </div>
            }
        >
            {error && <Alert variant="error" className="mb-6">{error}</Alert>}

            <GoogleButton onClick={handleGoogleSignIn} isLoading={isGoogleLoading} />
            <OrDivider />

            <form onSubmit={handleSubmit} className="space-y-4">
                <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
                <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
                <Button type="submit" variant="ink" size="lg" className="w-full !mt-6" isLoading={isLoading}>
                    Sign in
                </Button>
            </form>
        </AuthFrame>
    );
}
