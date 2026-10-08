"use client";

import React, { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { supabase } from '@/lib/supabase';

const RESEND_SECONDS = 60;

/**
 * Second step of a password sign-up: the account only works once the person
 * enters the code emailed to them, which proves they own the address. The same
 * email also has a link that does the same thing.
 */
export function ConfirmEmailCode({
    email,
    onVerified,
    onBack,
    sentOnMount = true,
}: {
    email: string;
    onVerified: (user: User) => void | Promise<void>;
    onBack: () => void;
    /** False when arriving from sign-in: no code has been sent in this visit yet. */
    sentOnMount?: boolean;
}) {
    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState(sentOnMount ? `We sent a 6-digit code to ${email}.` : '');
    const [busy, setBusy] = useState(false);
    const [cooldown, setCooldown] = useState(sentOnMount ? RESEND_SECONDS : 0);

    useEffect(() => {
        if (cooldown <= 0) return;
        const t = setTimeout(() => setCooldown(c => c - 1), 1000);
        return () => clearTimeout(t);
    }, [cooldown]);

    const verify = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setBusy(true);
        const { data, error: verifyError } = await supabase.auth.verifyOtp({ email, token: code, type: 'signup' });
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
        const { error: resendError } = await supabase.auth.resend({
            type: 'signup',
            email,
            options: { emailRedirectTo: `${window.location.origin}/complete-registration` },
        });
        if (resendError) {
            setError(resendError.message.toLowerCase().includes('rate')
                ? 'Too many codes requested. Wait a few minutes and try again.'
                : 'Could not send a new code. Please try again.');
            return;
        }
        setNotice(`New code sent to ${email}. It may take a minute to arrive.`);
        setCooldown(RESEND_SECONDS);
    };

    return (
        <div className="space-y-5">
            {notice && <Alert variant="info">{notice} Check your spam folder if you can&rsquo;t find it.</Alert>}
            {error && <Alert variant="error">{error}</Alert>}

            <form onSubmit={verify} className="space-y-4" noValidate>
                <Input
                    label="Code from the email"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    className="font-mono tracking-[0.3em]"
                    helperText="You can also open the link in the same email."
                />
                <Button type="submit" variant="primary" size="lg" className="w-full" isLoading={busy} disabled={code.length < 6}>
                    Confirm email
                </Button>
            </form>

            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <button type="button" onClick={onBack} className="text-gray-600 underline underline-offset-4 hover:text-gray-900">
                    Use a different email
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
