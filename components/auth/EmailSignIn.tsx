"use client";

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { otpError } from '@/lib/auth-errors';
import { friendlyAuthError } from '@/components/auth/GoogleButton';
import { ConfirmEmailCode } from '@/components/auth/ConfirmEmailCode';
import { TurnstileField, type TurnstileHandle } from '@/components/TurnstileField';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const linkClass = 'font-medium text-gray-900 underline decoration-gray-300 underline-offset-4 hover:decoration-gray-900';

/**
 * Signing in with an email address, for the sign-in page and dialog:
 *   - email and password;
 *   - or "Email me a code": for accounts without a password (made with an
 *     email code when requesting blood or joining) and anyone who forgot it.
 *     Existing accounts only; a new address is pointed to Join.
 *   - an account whose sign-up email was never confirmed is offered a code
 *     that confirms it and signs in.
 * The session change is picked up by AuthContext; onSignedIn is a hint.
 */
export function EmailSignIn({
    onSignedIn,
    registerHref = '/register',
}: {
    onSignedIn?: () => void;
    registerHref?: string;
}) {
    const { signIn } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<React.ReactNode>('');
    const [busy, setBusy] = useState<'password' | 'code' | null>(null);
    // 'code': a sign-in code was emailed. 'confirm': the sign-up email still needs confirming.
    const [step, setStep] = useState<'form' | 'code' | 'confirm'>('form');
    const captcha = useRef<TurnstileHandle>(null);

    const signInWithPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!EMAIL_RE.test(email.trim())) { setError('Enter the email address you registered with.'); return; }
        if (!password) { setError(<>Enter your password, or <button type="button" onClick={sendCode} className={linkClass}>email me a code</button> instead.</>); return; }
        setBusy('password');
        try {
            await signIn(email.trim(), password, await captcha.current?.getToken());
            onSignedIn?.();
        } catch (err: any) {
            captcha.current?.reset(); // tokens work once
            if (String(err?.message).includes('Email not confirmed')) {
                setStep('confirm');
            } else if (String(err?.message).includes('Invalid login credentials')) {
                setError(<>That email and password don’t match. Try again, or <button type="button" onClick={sendCode} className={linkClass}>email me a code</button> instead.</>);
            } else {
                setError(friendlyAuthError(err?.message));
            }
        } finally {
            setBusy(null);
        }
    };

    async function sendCode() {
        setError('');
        const address = email.trim();
        if (!EMAIL_RE.test(address)) { setError('Enter your email address first, then ask for a code.'); return; }
        setBusy('code');
        const { error: otpErr } = await supabase.auth.signInWithOtp({
            email: address,
            options: {
                captchaToken: await captcha.current?.getToken(),
                shouldCreateUser: false,
                emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
        });
        captcha.current?.reset();
        setBusy(null);
        if (otpErr) {
            const problem = otpError(otpErr.message);
            if (problem.kind === 'no_account') {
                setError(<>There’s no Vital account with this email yet. <Link href={registerHref} className={linkClass}>Join Vital</Link> in about a minute.</>);
                return;
            }
            // A code went out a moment ago: that one still works.
            if (problem.kind !== 'wait') { setError(problem.text); return; }
        }
        setEmail(address);
        setStep('code');
    }

    if (step !== 'form') {
        return (
            <div className="space-y-4">
                <p className="text-sm leading-relaxed text-gray-600">
                    {step === 'code'
                        ? <>Enter the 6-digit code we emailed to <span className="text-gray-900">{email}</span>.</>
                        : <>The email for this account hasn’t been confirmed yet. Send yourself a code, enter it, and you’re signed in.</>}
                </p>
                <ConfirmEmailCode
                    email={email}
                    flow={step === 'code' ? 'email' : 'signup'}
                    sentOnMount={step === 'code'}
                    redirectTo={`${window.location.origin}/auth/callback`}
                    backLabel="Back"
                    onBack={() => { setStep('form'); setError(''); }}
                    onVerified={() => onSignedIn?.()}
                />
            </div>
        );
    }

    return (
        <form onSubmit={signInWithPassword} className="space-y-4" noValidate>
            {error && <Alert variant="error">{error}</Alert>}
            <Input
                label="Email"
                type="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
            />
            <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            <TurnstileField ref={captcha} />
            <Button type="submit" variant="ink" size="lg" className="w-full !mt-6" isLoading={busy === 'password'} disabled={!!busy}>
                Sign in
            </Button>
            <Button type="button" variant="ghost" size="lg" className="w-full" onClick={sendCode} isLoading={busy === 'code'} disabled={!!busy}>
                No password? Email me a code
            </Button>
        </form>
    );
}
