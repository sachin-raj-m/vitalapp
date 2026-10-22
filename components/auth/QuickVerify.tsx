"use client";

import React, { useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { supabase } from '@/lib/supabase';
import { consentStamp } from '@/lib/legal';
import { otpError } from '@/lib/auth-errors';
import { PHONE_SIGNIN } from '@/lib/features';
import { TurnstileField, type TurnstileHandle } from '@/components/TurnstileField';
import { WhatsAppSignIn } from '@/components/auth/WhatsAppSignIn';
import { CODE_LENGTH, CodeInput } from '@/components/auth/CodeInput';

const RESEND_SECONDS = 60;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * One verification for people without an account (e.g. posting a request):
 * a code by email, or "Continue with WhatsApp" when that's switched on. Either
 * signs them in (a new account is created with the consent ticked on the page).
 *
 * Email: signInWithOtp({ shouldCreateUser }) then verifyOtp type 'email', which
 * accepts both a new account's signup code and an existing account's sign-in
 * code. The code arrives with the "Confirm signup" email for a new address and
 * the "Magic link" email for a known one; both templates must include
 * {{ .Token }}.
 */
export function QuickVerify({
    consented,
    onNeedConsent,
    onVerified,
    initialPhone = '',
    emailRedirectTo,
}: {
    /** The page's consent box is ticked. */
    consented: boolean;
    /** Called when a code is asked for before the box is ticked. */
    onNeedConsent?: () => void;
    onVerified: (user: User) => void | Promise<void>;
    initialPhone?: string;
    emailRedirectTo?: string;
}) {
    const [method, setMethod] = useState<'email' | 'whatsapp'>('email');
    const [email, setEmail] = useState('');
    const [sentTo, setSentTo] = useState<string | null>(null);
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [cooldown, setCooldown] = useState(0);
    const captcha = useRef<TurnstileHandle>(null);

    useEffect(() => {
        if (cooldown <= 0) return;
        const t = setTimeout(() => setCooldown(c => c - 1), 1000);
        return () => clearTimeout(t);
    }, [cooldown]);

    const sendCode = async () => {
        setError('');
        setNotice('');
        const address = email.trim();
        if (!EMAIL_RE.test(address)) {
            setError('Enter a valid email address to get a code.');
            return;
        }
        if (!consented) {
            onNeedConsent?.();
            return;
        }
        setBusy(true);
        const captchaToken = await captcha.current?.getToken();
        const { error: otpErr } = await supabase.auth.signInWithOtp({
            email: address,
            options: {
                captchaToken,
                shouldCreateUser: true,
                emailRedirectTo,
                // Checked by the Before User Created hook; copied onto the new profile.
                data: consentStamp(),
            },
        });
        captcha.current?.reset(); // tokens work once
        setBusy(false);
        if (otpErr) {
            const e = otpError(otpErr.message);
            if (e.kind === 'wait') {
                setSentTo(address);
                setCooldown(e.waitSeconds ?? RESEND_SECONDS);
            }
            setError(e.text);
            return;
        }
        setSentTo(address);
        setCode('');
        setCooldown(RESEND_SECONDS);
        setNotice(`We sent a 6-digit code to ${address}. It can take a minute to arrive.`);
    };

    // Runs as soon as the sixth digit is in, or from the button.
    const confirm = async (token = code) => {
        if (!sentTo || busy || token.length < CODE_LENGTH) return;
        setError('');
        setBusy(true);
        const { data, error: verifyErr } = await supabase.auth.verifyOtp({ email: sentTo, token, type: 'email' });
        if (verifyErr || !data.user) {
            setBusy(false);
            setError(otpError(verifyErr?.message).kind === 'wait'
                ? otpError(verifyErr?.message).text
                : 'That code is incorrect or has expired. Check it, or send a new one.');
            return;
        }
        await onVerified(data.user);
        setBusy(false);
    };

    const tab = (value: 'email' | 'whatsapp', label: string) => (
        <button
            type="button"
            role="tab"
            aria-selected={method === value}
            onClick={() => { setMethod(value); setError(''); }}
            className={`h-9 rounded-full border px-4 text-sm transition-colors ${method === value ? 'border-gray-900 bg-gray-900 text-gray-50' : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'}`}
        >
            {label}
        </button>
    );

    return (
        <div className="space-y-4">
            {PHONE_SIGNIN && (
                <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Verify with">
                    {tab('email', 'Email code')}
                    {tab('whatsapp', 'WhatsApp')}
                </div>
            )}

            {method === 'whatsapp' && PHONE_SIGNIN ? (
                <fieldset disabled={!consented} className="m-0 min-w-0 border-0 p-0">
                    <WhatsAppSignIn
                        consented={consented}
                        initialPhone={initialPhone}
                        submitLabel="Get a code on WhatsApp"
                        onSignedIn={onVerified}
                        onUseEmail={() => setMethod('email')}
                    />
                    
                </fieldset>
            ) : (
                <>
                    {notice && <Alert variant="info">{notice} Not there? Check your spam or promotions folder.</Alert>}
                    {error && <Alert variant="error">{error}</Alert>}
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                        <div className="flex-1">
                            <Input
                                label="Your email"
                                type="email"
                                autoComplete="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={!!sentTo}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (!sentTo) sendCode(); } }}
                            />
                        </div>
                        {sentTo ? (
                            <Button type="button" variant="ghost" onClick={() => { setSentTo(null); setCode(''); setNotice(''); setError(''); }}>
                                Change email
                            </Button>
                        ) : (
                            <Button type="button" variant="secondary" onClick={sendCode} isLoading={busy}>
                                Send code
                            </Button>
                        )}
                    </div>
                    {sentTo && (
                        <>
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                                <div className="flex-1">
                                    <div onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirm(); } }}>
                                        <CodeInput label="Code from the email" value={code} onChange={setCode} onComplete={confirm} />
                                    </div>
                                </div>
                                <Button type="button" variant="ink" onClick={() => confirm()} isLoading={busy} disabled={code.length < CODE_LENGTH}>
                                    Verify
                                </Button>
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                                <button
                                    type="button"
                                    onClick={sendCode}
                                    disabled={cooldown > 0 || busy}
                                    className="text-gray-900 underline underline-offset-4 disabled:cursor-not-allowed disabled:text-gray-500 disabled:no-underline"
                                >
                                    {cooldown > 0 ? `Send a new code in ${cooldown}s` : 'Send a new code'}
                                </button>
                                {PHONE_SIGNIN && (
                                    <button type="button" onClick={() => setMethod('whatsapp')} className="text-gray-600 underline underline-offset-4 hover:text-gray-900">
                                        No email? Use WhatsApp instead
                                    </button>
                                )}
                            </div>
                        </>
                    )}
                    {/* Kept mounted so "Send a new code" gets a fresh token. */}
                    <TurnstileField ref={captcha} />
                </>
            )}
        </div>
    );
}
