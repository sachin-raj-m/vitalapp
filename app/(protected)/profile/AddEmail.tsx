"use client";

import React, { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { supabase } from '@/lib/supabase';
import { otpError } from '@/lib/auth-errors';

const RESEND_SECONDS = 60;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Supabase's "email change" errors, in plain words. */
function addEmailError(message?: string | null) {
    const m = (message || '').toLowerCase();
    if (m.includes('already been registered') || m.includes('already registered') || m.includes('email_exists') || m.includes('already exists')) {
        return { kind: 'taken' as const, text: 'That email already belongs to another Vital account. Use a different one, or sign in to that account instead.' };
    }
    return otpError(message);
}

/**
 * Adds an email to an account that has none (made with "Continue with
 * WhatsApp"), so the person has a second way in. Uses Supabase's email change:
 * updateUser({ email }) sends the "Change email address" email (a code, and a
 * link that does the same) to the new address; verifyOtp type 'email_change'
 * confirms it. Then auth.users.email and email_confirmed_at are set, and the
 * sync_profile_email trigger copies both to the profile.
 *
 * The "Change email address" template must include {{ .Token }} for the code.
 */
export function AddEmail({
    isOpen,
    onClose,
    onAdded,
}: {
    isOpen: boolean;
    onClose: () => void;
    onAdded: (email: string) => void | Promise<void>;
}) {
    const [step, setStep] = useState<'email' | 'code'>('email');
    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [busy, setBusy] = useState(false);
    const [cooldown, setCooldown] = useState(0);

    useEffect(() => {
        if (cooldown <= 0) return;
        const t = setTimeout(() => setCooldown(c => c - 1), 1000);
        return () => clearTimeout(t);
    }, [cooldown]);

    const close = () => {
        setStep('email'); setCode(''); setError(''); setNotice(''); setBusy(false);
        onClose();
    };

    const send = async (to: string) => {
        const { error: sendError } = await supabase.auth.updateUser(
            { email: to },
            { emailRedirectTo: `${window.location.origin}/auth/callback?next=/profile/edit` },
        );
        if (sendError) {
            const e = addEmailError(sendError.message);
            if (e.kind === 'wait') setCooldown(e.waitSeconds ?? RESEND_SECONDS);
            setError(e.text);
            return false;
        }
        setCooldown(RESEND_SECONDS);
        return true;
    };

    const start = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(''); setNotice('');
        const to = email.trim().toLowerCase();
        if (!EMAIL_RE.test(to)) { setError('Enter a valid email address.'); return; }
        setBusy(true);
        if (await send(to)) {
            setEmail(to);
            setCode('');
            setStep('code');
            setNotice(`We sent a 6-digit code to ${to}.`);
        }
        setBusy(false);
    };

    const resend = async () => {
        setError(''); setNotice('');
        if (await send(email)) setNotice(`New code sent to ${email}. It may take a minute to arrive.`);
    };

    const verify = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setBusy(true);
        const { data, error: verifyError } = await supabase.auth.verifyOtp({ email, token: code, type: 'email_change' });
        if (verifyError || !data.user) {
            setBusy(false);
            setError(verifyError && otpError(verifyError.message).kind === 'wait'
                ? otpError(verifyError.message).text
                : 'That code is incorrect or has expired. Check it or send a new one.');
            return;
        }
        await onAdded(data.user.email || email);
        close();
    };

    return (
        <Modal isOpen={isOpen} onClose={close} title={step === 'email' ? 'Add an email' : 'Confirm your email'}>
            {step === 'email' ? (
                <form onSubmit={start} className="space-y-5" noValidate>
                    <p className="leading-relaxed text-gray-600">
                        Optional. It gives you a second way to sign in if you can&rsquo;t use WhatsApp, and lets you set a password.
                        We&rsquo;ll email you a code to confirm it&rsquo;s yours.
                    </p>
                    {error && <Alert variant="error">{error}</Alert>}
                    <Input
                        label="Email address"
                        type="email"
                        autoComplete="email"
                        autoFocus
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <Button type="button" variant="secondary" onClick={close}>Cancel</Button>
                        <Button type="submit" variant="ink" isLoading={busy} disabled={!email.trim()}>Send code</Button>
                    </div>
                </form>
            ) : (
                <form onSubmit={verify} className="space-y-5" noValidate>
                    {notice && <Alert variant="info">{notice} Check your spam folder if you can&rsquo;t find it.</Alert>}
                    {error && <Alert variant="error">{error}</Alert>}
                    <Input
                        label="Code from the email"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        autoFocus
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                        placeholder="000000"
                        className="h-14 text-center font-mono text-2xl tracking-[0.4em]"
                        helperText="You can also open the link in the same email."
                    />
                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                        <button type="button" onClick={() => { setStep('email'); setError(''); setNotice(''); }} className="text-gray-600 underline underline-offset-4 hover:text-gray-900">
                            Use a different email
                        </button>
                        <button
                            type="button"
                            onClick={resend}
                            disabled={cooldown > 0}
                            className="text-gray-900 underline underline-offset-4 disabled:cursor-not-allowed disabled:text-gray-500 disabled:no-underline"
                        >
                            {cooldown > 0 ? `Send a new code in ${cooldown}s` : 'Send a new code'}
                        </button>
                    </div>
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <Button type="button" variant="secondary" onClick={close}>Cancel</Button>
                        <Button type="submit" variant="ink" isLoading={busy} disabled={code.length < 6}>Confirm email</Button>
                    </div>
                </form>
            )}
        </Modal>
    );
}
