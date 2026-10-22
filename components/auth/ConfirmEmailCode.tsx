"use client";

import React, { useEffect, useState, useRef } from 'react';
import type { User } from '@supabase/supabase-js';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { supabase } from '@/lib/supabase';
import { TurnstileField, type TurnstileHandle } from '@/components/TurnstileField';
import { otpError } from '@/lib/auth-errors';
import { CODE_LENGTH, CodeInput } from '@/components/auth/CodeInput';

const RESEND_SECONDS = 60;

/**
 * Entering the 6-digit code emailed to someone, which proves they own the
 * address and signs them in. The same email also has a link that does the same.
 *
 *   flow 'email'   a code from signInWithOtp: signing up without a password
 *                  (createWith carries the consent for a new account) or
 *                  signing in to an existing account.
 *   flow 'signup'  the code from a password sign-up's "Confirm signup" email.
 *
 * The code is checked as soon as the sixth digit is in.
 */
export function ConfirmEmailCode({
    email,
    onVerified,
    onBack,
    sentOnMount = true,
    backLabel = 'Use a different email',
    flow = 'signup',
    createWith,
    redirectTo,
}: {
    email: string;
    onVerified: (user: User) => void | Promise<void>;
    onBack: () => void;
    /** False when arriving from sign-in: no code has been sent in this visit yet. */
    sentOnMount?: boolean;
    backLabel?: string;
    flow?: 'signup' | 'email';
    /** flow 'email': sign-up metadata (consent) when a new code may create the account. */
    createWith?: Record<string, unknown>;
    /** Where the link in the email lands. */
    redirectTo?: string;
}) {
    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState(sentOnMount ? `We sent a 6-digit code to ${email}. It usually arrives within a minute.` : '');
    const [busy, setBusy] = useState(false);
    const [cooldown, setCooldown] = useState(sentOnMount ? RESEND_SECONDS : 0);
    const captcha = useRef<TurnstileHandle>(null);

    useEffect(() => {
        if (cooldown <= 0) return;
        const t = setTimeout(() => setCooldown(c => c - 1), 1000);
        return () => clearTimeout(t);
    }, [cooldown]);

    const verify = async (token = code) => {
        if (busy || token.length < CODE_LENGTH) return;
        setError('');
        setBusy(true);
        const { data, error: verifyError } = await supabase.auth.verifyOtp({ email, token, type: flow });
        if (verifyError || !data.user) {
            setBusy(false);
            setError('That code is incorrect or has expired. Check it or send a new one.');
            return;
        }
        await onVerified(data.user);
        setBusy(false);
    };

    const resend = async () => {
        setError('');
        setNotice('');
        const emailRedirectTo = redirectTo ?? `${window.location.origin}/complete-registration`;
        const captchaToken = await captcha.current?.getToken();
        const { error: resendError } = flow === 'signup'
            ? await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo, captchaToken } })
            : await supabase.auth.signInWithOtp({
                email,
                options: { captchaToken, emailRedirectTo, shouldCreateUser: !!createWith, ...(createWith ? { data: createWith } : {}) },
            });
        captcha.current?.reset(); // tokens work once
        if (resendError) {
            const e = otpError(resendError.message);
            if (e.kind === 'wait') setCooldown(e.waitSeconds ?? RESEND_SECONDS);
            setError(e.kind === 'other' ? 'Could not send a new code. Please try again.' : e.text);
            return;
        }
        setCode('');
        setNotice(`New code sent to ${email}. It may take a minute to arrive.`);
        setCooldown(RESEND_SECONDS);
    };

    return (
        <div className="space-y-5">
            {notice && <Alert variant="info">{notice} Check your spam folder if you can&rsquo;t find it.</Alert>}
            {error && <Alert variant="error">{error}</Alert>}

            <form onSubmit={(e) => { e.preventDefault(); verify(); }} className="space-y-4" noValidate>
                <CodeInput
                    label="Code from the email"
                    value={code}
                    onChange={setCode}
                    onComplete={verify}
                    helperText="You can also open the link in the same email."
                />
                <Button type="submit" variant="primary" size="lg" className="w-full" isLoading={busy} disabled={code.length < CODE_LENGTH}>
                    {flow === 'signup' ? 'Confirm email' : 'Continue'}
                </Button>
            </form>

            <TurnstileField ref={captcha} />
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <button type="button" onClick={onBack} className="text-gray-600 underline underline-offset-4 hover:text-gray-900">
                    {backLabel}
                </button>
                <button
                    type="button"
                    onClick={resend}
                    disabled={cooldown > 0}
                    className="text-gray-900 underline underline-offset-4 disabled:cursor-not-allowed disabled:text-gray-500 disabled:no-underline"
                >
                    {cooldown > 0 ? `Send a new code in ${cooldown}s` : sentOnMount || notice ? 'Send a new code' : 'Send me a code'}
                </button>
            </div>
        </div>
    );
}
