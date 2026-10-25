"use client";

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { otpError } from '@/lib/auth-errors';
import { waNumber } from '@/lib/phone';
import { PHONE_SIGNIN } from '@/lib/features';
import { friendlyAuthError } from '@/components/auth/GoogleButton';
import { ConfirmEmailCode } from '@/components/auth/ConfirmEmailCode';
import { NewNumberConsent, WhatsAppCodeStep, sendWhatsAppCode } from '@/components/auth/WhatsAppSignIn';
import { TurnstileField, type TurnstileHandle } from '@/components/TurnstileField';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const linkClass = 'font-medium text-gray-900 underline decoration-gray-300 underline-offset-4 hover:decoration-gray-900';

/** What someone typed in the one field: an email, an Indian mobile number (as "919876543210"), or neither. */
export function readIdentifier(raw: string, phoneAllowed = PHONE_SIGNIN):
    | { kind: 'email'; email: string }
    | { kind: 'phone'; wa: string }
    | { kind: 'invalid'; message: string } {
    const value = raw.trim();
    if (!value) return { kind: 'invalid', message: phoneAllowed ? 'Enter your email or mobile number.' : 'Enter your email address.' };
    if (value.includes('@')) {
        return EMAIL_RE.test(value)
            ? { kind: 'email', email: value }
            : { kind: 'invalid', message: 'That doesn’t look like an email address. Check it and try again.' };
    }
    const looksLikePhone = /^[\d\s()+-]+$/.test(value);
    if (!phoneAllowed) {
        return { kind: 'invalid', message: looksLikePhone ? 'Signing in with a mobile number isn’t available yet. Enter your email address.' : 'That doesn’t look like an email address. Check it and try again.' };
    }
    const wa = waNumber(value);
    if (wa) return { kind: 'phone', wa };
    return {
        kind: 'invalid',
        message: looksLikePhone
            ? 'Enter a 10-digit Indian mobile number, like 98765 43210.'
            : 'Enter an email address or a 10-digit Indian mobile number.',
    };
}

export type CodeSent = { via: 'email' | 'whatsapp'; to: string };

type Step =
    | { name: 'start' }
    | { name: 'email'; email: string }
    // An account made with a password whose sign-up email was never confirmed.
    | { name: 'confirm'; email: string }
    | { name: 'whatsapp'; wa: string; create: boolean };

/**
 * One field ("Email or mobile number", or just "Email" when phone sign-in is
 * off) and one Continue, for Join, Login and the sign-in dialog. A mobile
 * number gets its code on WhatsApp (the person sends LOGIN to Vital); an email
 * gets it by email. Either way the next step is a single code box, and the
 * code signs the person in.
 *
 *   purpose 'join'    new accounts are created with signUpData() (the page's
 *                     "By continuing, you agree…" is the consent); an existing
 *                     account is simply signed in.
 *   purpose 'signin'  an unknown email is pointed to Join; an unknown number
 *                     is asked for consent here, then gets an account. A small
 *                     "Use a password instead" reveals a password field.
 *
 * `children` (e.g. GoogleOption) shows under the form until a code is sent.
 */
export function ContinueSignIn({
    purpose,
    onSignedIn,
    signUpData,
    emailRedirectTo,
    beforeEmailCode,
    registerHref = '/register',
    onCodeSent,
    children,
}: {
    purpose: 'join' | 'signin';
    /** Runs once there is a session. AuthContext picks the session up too. */
    onSignedIn: (user: User) => void | Promise<void>;
    /** join: metadata for a new email account (checked by the Before User Created hook). */
    signUpData?: () => Record<string, unknown>;
    /** Where the link in the email lands. Default /auth/callback. */
    emailRedirectTo?: () => string;
    /** Runs just before an email code is asked for (e.g. remember where to go next). */
    beforeEmailCode?: () => void;
    registerHref?: string;
    /** Told when the code step opens (and null on going back), so the page can change its heading. */
    onCodeSent?: (sent: CodeSent | null) => void;
    children?: React.ReactNode;
}) {
    const { signIn } = useAuth();
    const [value, setValue] = useState('');
    const [password, setPassword] = useState('');
    const [usePassword, setUsePassword] = useState(false);
    const [fieldError, setFieldError] = useState('');
    const [error, setError] = useState<React.ReactNode>('');
    const [busy, setBusy] = useState(false);
    const [step, setStepState] = useState<Step>({ name: 'start' });
    // signin: an unknown number needs the person's consent before it gets an account.
    const [askConsent, setAskConsent] = useState(false);
    const [consent, setConsent] = useState(false);
    const captcha = useRef<TurnstileHandle>(null);
    const fieldId = `continue-${React.useId().replace(/:/g, '')}`;

    const joining = purpose === 'join';
    const phoneAllowed = PHONE_SIGNIN && !usePassword;
    const redirectTo = () => emailRedirectTo?.() ?? `${window.location.origin}/auth/callback`;

    const setStep = (next: Step) => {
        setStepState(next);
        onCodeSent?.(
            next.name === 'email' || next.name === 'confirm' ? { via: 'email', to: next.email }
                : next.name === 'whatsapp' ? { via: 'whatsapp', to: next.wa }
                    : null,
        );
    };
    const backToStart = (clear = false) => {
        if (clear) setValue('');
        setError('');
        setStep({ name: 'start' });
        // Back in the field, ready to edit.
        setTimeout(() => document.getElementById(fieldId)?.focus(), 0);
    };

    const sendEmailCode = async (email: string) => {
        beforeEmailCode?.();
        const { error: otpErr } = await supabase.auth.signInWithOtp({
            email,
            options: {
                captchaToken: await captcha.current?.getToken(),
                shouldCreateUser: joining,
                ...(joining && signUpData ? { data: signUpData() } : {}),
                emailRedirectTo: redirectTo(),
            },
        });
        captcha.current?.reset(); // tokens work once
        if (otpErr) {
            const problem = otpError(otpErr.message);
            if (problem.kind === 'no_account') {
                setError(<>There’s no Vital account with this email yet. <Link href={registerHref} className={linkClass}>Join Vital</Link> in about a minute.</>);
                return;
            }
            if (problem.kind === 'invalid_address') { setFieldError(problem.text); return; }
            // A code went out a moment ago: that one still works.
            if (problem.kind !== 'wait') { setError(problem.text); return; }
        }
        setStep({ name: 'email', email });
    };

    const sendPhoneCode = async (wa: string, create: boolean): Promise<void> => {
        const problem = await sendWhatsAppCode(wa, create, await captcha.current?.getToken());
        captcha.current?.reset();
        if (problem) {
            if (problem.kind === 'no_account') {
                // signin: a new number. Ask for consent here, then create the account.
                setAskConsent(true);
                return;
            }
            setError(problem.text);
            return;
        }
        setStep({ name: 'whatsapp', wa, create });
    };

    const signInWithPassword = async (email: string) => {
        if (!password) { setError('Enter your password, or use a code instead.'); return; }
        try {
            await signIn(email, password, await captcha.current?.getToken());
            const { data } = await supabase.auth.getSession();
            if (data.session?.user) await onSignedIn(data.session.user);
        } catch (err) {
            captcha.current?.reset(); // tokens work once
            const message = err instanceof Error ? err.message : '';
            if (message.includes('Email not confirmed')) {
                setStep({ name: 'confirm', email });
            } else if (message.includes('Invalid login credentials')) {
                setError(<>That email and password don’t match. Try again, or <button type="button" onClick={() => switchToCode()} className={linkClass}>use a code instead</button>.</>);
            } else {
                setError(friendlyAuthError(message));
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setFieldError('');
        const id = readIdentifier(value, phoneAllowed);
        if (id.kind === 'invalid') {
            setFieldError(usePassword && /^[\d\s()+-]+$/.test(value.trim()) && PHONE_SIGNIN
                ? 'Passwords work with an email address. Enter your email, or use a code instead.'
                : id.message);
            return;
        }
        if (id.kind === 'phone' && askConsent && !consent) {
            setError('Tick the box to agree to the Terms and Privacy notice, then continue.');
            return;
        }
        setBusy(true);
        try {
            if (id.kind === 'phone') await sendPhoneCode(id.wa, joining || (askConsent && consent));
            else if (usePassword) await signInWithPassword(id.email);
            else await sendEmailCode(id.email);
        } finally {
            setBusy(false);
        }
    };

    function switchToCode() {
        setUsePassword(false);
        setPassword('');
        setError('');
        setFieldError('');
    }

    if (step.name === 'whatsapp') {
        const { wa, create } = step;
        return (
            <WhatsAppCodeStep
                key={wa}
                sentTo={wa}
                onSignedIn={onSignedIn}
                onResend={(token) => sendWhatsAppCode(wa, create, token)}
                onBack={() => backToStart()}
                backLabel="Use a different number or email"
                onUseEmail={() => backToStart(true)}
            />
        );
    }

    if (step.name === 'email' || step.name === 'confirm') {
        return (
            <div className="space-y-4">
                {step.name === 'confirm' && (
                    <p className="text-sm leading-relaxed text-gray-600">
                        The email for this account hasn’t been confirmed yet. Send yourself a code, enter it, and you’re signed in.
                    </p>
                )}
                <ConfirmEmailCode
                    email={step.email}
                    flow={step.name === 'email' ? 'email' : 'signup'}
                    sentOnMount={step.name === 'email'}
                    createWith={joining ? signUpData?.() : undefined}
                    redirectTo={redirectTo()}
                    backLabel={PHONE_SIGNIN ? 'Use a different email or number' : 'Use a different email'}
                    onBack={() => backToStart()}
                    onVerified={onSignedIn}
                />
            </div>
        );
    }

    const typedPhone = phoneAllowed && readIdentifier(value).kind === 'phone';
    const helper = usePassword ? undefined : [
        PHONE_SIGNIN ? 'We’ll send you a 6-digit code (on WhatsApp for a mobile number).' : 'We’ll email you a 6-digit code.',
        joining ? 'No password needed.' : '',
    ].join(' ').trim();

    return (
        <div>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                {error && <Alert variant="error">{error}</Alert>}
                <Input
                    id={fieldId}
                    label={phoneAllowed ? 'Email or mobile number' : 'Email'}
                    // Not type="email": a mobile number has to fit too.
                    type={phoneAllowed ? 'text' : 'email'}
                    inputMode={phoneAllowed ? 'text' : 'email'}
                    autoComplete={phoneAllowed || usePassword ? 'username' : 'email'}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder={phoneAllowed ? 'you@example.com or 98765 43210' : 'you@example.com'}
                    value={value}
                    onChange={(e) => { setValue(e.target.value); setFieldError(''); setAskConsent(false); }}
                    error={fieldError}
                    helperText={helper}
                />
                {usePassword && (
                    <div className="space-y-1.5">
                        <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
                        <div className="flex flex-wrap justify-between gap-3 text-[13px]">
                            <button type="button" onClick={switchToCode} className="text-gray-600 underline underline-offset-4 hover:text-gray-900">
                                Use a code instead
                            </button>
                            <Link href="/forgot-password" className="text-gray-600 underline underline-offset-4 hover:text-gray-900">
                                Forgot password?
                            </Link>
                        </div>
                    </div>
                )}
                {askConsent && typedPhone && <NewNumberConsent checked={consent} onChange={setConsent} />}
                <TurnstileField ref={captcha} />
                <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    className="w-full !mt-6"
                    isLoading={busy}
                    disabled={askConsent && typedPhone && !consent}
                >
                    {usePassword ? 'Sign in' : askConsent && typedPhone ? 'Create account and continue' : 'Continue'}
                </Button>
                {!joining && !usePassword && (
                    <p className="text-center text-[13px]">
                        <button
                            type="button"
                            onClick={() => { setUsePassword(true); setError(''); setFieldError(''); setAskConsent(false); }}
                            className="text-gray-600 underline underline-offset-4 hover:text-gray-900"
                        >
                            Use a password instead
                        </button>
                    </p>
                )}
            </form>
            {children}
        </div>
    );
}
