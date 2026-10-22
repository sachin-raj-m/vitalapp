"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthFrame, authLinkClass } from '@/components/auth/AuthFrame';
import { OrDivider, friendlyAuthError } from '@/components/auth/GoogleButton';
import { Alert } from '@/components/ui/Alert';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { cleanNext, pathAfterSignIn, rememberNext, withRedirect } from '@/lib/auth-helpers';
import { WhatsAppSignIn } from '@/components/auth/WhatsAppSignIn';
import { PHONE_SIGNIN } from '@/lib/features';
import { safeInternalPath } from '@/lib/site';
import { GoogleSignIn } from '@/components/auth/GoogleSignIn';
import { EmailSignIn } from '@/components/auth/EmailSignIn';
import { TurnstileField, type TurnstileHandle } from '@/components/TurnstileField';

/**
 * Signing in: Google, WhatsApp (when switched on), or email with a password
 * or an emailed code. The same order as Join and the sign-in dialog. Once
 * signed in, ?redirect= (or ?from=) is honoured (lib/auth-helpers.ts
 * pathAfterSignIn).
 */
export default function LoginPage() {
    const router = useRouter();
    const { user, session } = useAuth();
    const [error, setError] = useState('');
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [redirect, setRedirect] = useState('');
    // Supabase checks a captcha on Google sign-in too.
    const captcha = useRef<TurnstileHandle>(null);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        setRedirect(safeInternalPath(params.get('redirect') || params.get('from'), ''));
        if (params.get('google') === 'failed') setError('Google sign-in didn’t finish. Try again, or use another way below.');
    }, []);

    useEffect(() => {
        if (!user) return;
        const params = new URLSearchParams(window.location.search);
        const next = safeInternalPath(params.get('redirect') || params.get('from'), '');
        // Donors to the dashboard, requesters to their requests, new accounts
        // to the short donor form (which they can skip).
        pathAfterSignIn(user.id, session?.user?.user_metadata, next).then(path => router.replace(path));
    }, [user, session, router]);

    const handleGoogleSignIn = async () => {
        setIsGoogleLoading(true);
        setError('');
        try {
            // Google's redirect can't carry ?redirect=; /auth/callback picks it up.
            rememberNext(redirect);
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                // No forced consent screen: returning people go straight back in.
                options: { redirectTo: `${window.location.origin}/auth/callback` },
            });
            if (error) throw error;
        } catch (err: any) {
            setError(friendlyAuthError(err?.message));
            setIsGoogleLoading(false);
        }
    };

    const registerHref = withRedirect('/register', cleanNext(redirect));

    return (
        <AuthFrame
            title="Sign in"
            subtitle={PHONE_SIGNIN ? 'Use Google, WhatsApp, or the email you registered with.' : 'Use Google, or the email you registered with.'}
            footer={
                <div className="flex flex-wrap justify-between gap-3">
                    <span>
                        New to Vital? <Link href={registerHref} className={authLinkClass}>Join in about a minute</Link>
                    </span>
                    <Link href="/forgot-password" className="text-gray-500 hover:text-gray-900">
                        Forgot password?
                    </Link>
                </div>
            }
        >
            {error && <Alert variant="error" className="mb-6">{error}</Alert>}

            <GoogleSignIn
                next={redirect}
                onFallback={handleGoogleSignIn}
                fallbackLoading={isGoogleLoading}
                getCaptchaToken={async () => { const t = await captcha.current?.getToken(); captcha.current?.reset(); return t; }}
                onError={message => setError(friendlyAuthError(message))}
            />
            <TurnstileField ref={captcha} />
            <p className="mt-3 text-[13px] leading-relaxed text-gray-500">
                New to Vital? Continuing with Google creates an account, and means you accept the{' '}
                <Link href="/terms" className={authLinkClass}>Terms</Link> and{' '}
                <Link href="/privacy" className={authLinkClass}>Privacy notice</Link>. You confirm this on the next screen.
            </p>
            {PHONE_SIGNIN && (
                <div className="mt-6">
                    {/* verifyOtp signs the person in; the effect above then routes them. */}
                    <WhatsAppSignIn onSignedIn={() => {}} />
                </div>
            )}
            <OrDivider />

            {/* Signing in updates the session; the effect above then routes them. */}
            <EmailSignIn registerHref={registerHref} />
        </AuthFrame>
    );
}
