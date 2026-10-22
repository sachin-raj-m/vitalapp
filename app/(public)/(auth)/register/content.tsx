"use client";

import { authedFetch } from '@/lib/api';
import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthFrame, authLinkClass } from '@/components/auth/AuthFrame';
import { OrDivider, friendlyAuthError } from '@/components/auth/GoogleButton';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { supabase } from '@/lib/supabase';
import { PLATFORM_DISCLAIMER, consentStamp, hasRecordedConsent } from '@/lib/legal';
import { otpError } from '@/lib/auth-errors';
import { ConfirmEmailCode } from '@/components/auth/ConfirmEmailCode';
import type { User } from '@supabase/supabase-js';
import { rememberReferral } from '@/lib/referrals';
import { TurnstileField, type TurnstileHandle } from '@/components/TurnstileField';
import { GoogleSignIn } from '@/components/auth/GoogleSignIn';
import { WhatsAppSignIn } from '@/components/auth/WhatsAppSignIn';
import { PHONE_SIGNIN } from '@/lib/features';
import { useAuth } from '@/context/AuthContext';
import { cleanNext, pathAfterSignUp, rememberNext, withRedirect } from '@/lib/auth-helpers';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Joining as a donor: one consent box, then Google, WhatsApp (when switched
 * on) or an email code. No password: the emailed code proves the address and
 * signs the person in (a password can be added later in Settings). The same
 * code signs in an existing account, so typing a registered email here isn't
 * a dead end. Then the short donor form (/complete-registration).
 *
 * ?redirect= is where they were heading (e.g. offering to donate for a
 * request); it is carried through the donor form. ?ref= is a referral code.
 */
export default function RegisterPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [agreed, setAgreed] = useState(false);
    // Set once a code has been emailed.
    const [pendingEmail, setPendingEmail] = useState<string | null>(null);
    const [next, setNext] = useState('');
    const captcha = useRef<TurnstileHandle>(null);
    const checkedSession = useRef(false);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        // Arrived from a referral link (/r/CODE): keep the code until registration completes.
        rememberReferral(params.get('ref'));
        setNext(cleanNext(params.get('redirect')));
    }, []);

    // Already signed in when the page opened: carry on instead of showing the form.
    useEffect(() => {
        if (authLoading || checkedSession.current) return;
        checkedSession.current = true;
        if (!user) return;
        const redirect = cleanNext(new URLSearchParams(window.location.search).get('redirect'));
        pathAfterSignUp(user.id, redirect).then(path => router.replace(path));
    }, [authLoading, user, router]);

    const consentError = 'Tick the box to agree to the Terms and Privacy notice before continuing.';
    // Only here to request blood? That needs no account up front.
    const requestLink = <Link href="/requests/new" className={authLinkClass}>post a request without an account</Link>;
    // Stored on the account when it is created (the database checks the consent).
    const signUpData = () => ({ registration_completed: false, ...consentStamp() });
    // Where the link in the email lands (the code entered here does the same).
    const emailLanding = () => `${window.location.origin}${withRedirect('/complete-registration', next)}`;

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
            // complete-registration records it against the account. Google's
            // redirect can't carry ?redirect= either.
            try { localStorage.setItem('pendingConsent', JSON.stringify(consentStamp())); } catch { /* storage unavailable */ }
            rememberNext(next);
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

    // Runs once the person has a session (email code or WhatsApp code).
    const finishSignUp = async (signedIn: User) => {
        // The database copies the sign-up consent onto a new profile. An
        // existing account signing in here has just ticked the box too: record
        // it if there's nothing on record yet (best effort).
        const { data: profile } = await supabase.from('profiles')
            .select('consent_agreed, consent_at, consent_version').eq('id', signedIn.id).maybeSingle();
        if (!hasRecordedConsent(profile)) {
            await supabase.from('profiles').update(consentStamp()).eq('id', signedIn.id).then(() => {}, () => {});
        }
        try {
            localStorage.setItem('pendingRegistration', JSON.stringify({ userId: signedIn.id, email: signedIn.email }));
        } catch { /* storage blocked */ }
        // Welcome email to the signed-in user's own address (server-side; new accounts only).
        if (signedIn.email) authedFetch('/api/notify/welcome', { method: 'POST' }).catch(() => {});
        router.push(await pathAfterSignUp(signedIn.id, next));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        const errors: Record<string, string> = {};
        const address = email.trim();
        if (!address) errors.email = 'Enter your email address.';
        else if (!EMAIL_RE.test(address)) errors.email = 'That doesn’t look like an email address. Check it and try again.';
        if (!agreed) errors.consent = consentError;
        setFieldErrors(errors);
        if (Object.keys(errors).length) return;

        setIsLoading(true);
        // In case they open the link in the email instead of typing the code.
        rememberNext(next);
        const { error: otpErr } = await supabase.auth.signInWithOtp({
            email: address,
            options: {
                captchaToken: await captcha.current?.getToken(),
                shouldCreateUser: true,
                // Checked by the Before User Created hook; copied onto the new profile.
                data: signUpData(),
                emailRedirectTo: emailLanding(),
            },
        });
        captcha.current?.reset(); // tokens work once
        setIsLoading(false);
        if (otpErr) {
            const problem = otpError(otpErr.message);
            // A code went out a moment ago: let them enter that one.
            if (problem.kind === 'wait') { setPendingEmail(address); return; }
            if (problem.kind === 'invalid_address') { setFieldErrors({ email: problem.text }); return; }
            setError(problem.text);
            return;
        }
        setPendingEmail(address);
    };

    if (pendingEmail) {
        return (
            <AuthFrame
                title="Check your email"
                subtitle={<>Enter the 6-digit code we sent to <span className="text-gray-900">{pendingEmail}</span>. Then add your blood group and district, and you’re done.</>}
                footer={<>Already registered with this email? The same code signs you in.</>}
            >
                <ConfirmEmailCode
                    email={pendingEmail}
                    flow="email"
                    createWith={signUpData()}
                    redirectTo={emailLanding()}
                    onVerified={finishSignUp}
                    onBack={() => setPendingEmail(null)}
                />
            </AuthFrame>
        );
    }

    return (
        <AuthFrame
            title="Join Vital"
            subtitle={`Sign up with ${PHONE_SIGNIN ? 'Google, WhatsApp or email' : 'Google or email'}, then add your blood group and district. It takes about a minute.`}
            footer={<>Already registered? <Link href={withRedirect('/login', next)} className={authLinkClass}>Sign in</Link></>}
        >
            {error && <Alert variant="error" className="mb-6">{error}</Alert>}

            <div className="mb-6">
                <label className="flex cursor-pointer items-start gap-3">
                    <input
                        type="checkbox"
                        checked={agreed}
                        onChange={(e) => { setAgreed(e.target.checked); if (e.target.checked) setFieldErrors(({ consent: _c, ...rest }) => rest); }}
                        aria-invalid={!!fieldErrors.consent}
                        aria-describedby={fieldErrors.consent ? 'consent-error' : !agreed ? 'consent-hint' : undefined}
                        className="mt-1 h-4 w-4 shrink-0 rounded-[4px] border-gray-400 accent-gray-900"
                    />
                    <span className="text-sm leading-relaxed text-gray-600">
                        I agree to the <Link href="/terms" target="_blank" className={authLinkClass}>Terms</Link> and have read the
                        {' '}<Link href="/privacy" target="_blank" className={authLinkClass}>Privacy notice</Link>.
                    </span>
                </label>
                {fieldErrors.consent
                    ? <p id="consent-error" className="ml-7 mt-1.5 text-[13px] text-red-700">{fieldErrors.consent}</p>
                    : !agreed && <p id="consent-hint" className="ml-7 mt-1.5 text-[13px] text-gray-500">Tick the box to continue. The buttons below stay off until you do.</p>}
            </div>

            {/* A disabled fieldset disables every way in until consent is ticked. */}
            <fieldset disabled={!agreed} aria-describedby={!agreed ? 'consent-hint' : undefined} className="m-0 min-w-0 border-0 p-0">
                <GoogleSignIn
                    disabled={!agreed}
                    next={next}
                    onFallback={handleGoogleSignUp}
                    fallbackLoading={isGoogleLoading}
                    getCaptchaToken={async () => { const t = await captcha.current?.getToken(); captcha.current?.reset(); return t; }}
                    // Google can't carry user metadata, so remember the consent locally;
                    // complete-registration records it against the account.
                    onBeforeSignIn={() => { try { localStorage.setItem('pendingConsent', JSON.stringify(consentStamp())); } catch { /* storage unavailable */ } }}
                    onError={message => setError(friendlyAuthError(message))}
                />
                {PHONE_SIGNIN && (
                    <div className="mt-4">
                        {/* The box above is the consent; the account is created with it. */}
                        <WhatsAppSignIn consented={agreed} onSignedIn={finishSignUp} />
                    </div>
                )}
            </fieldset>
            <OrDivider />

            {/* Typing is fine before the box is ticked; the button waits for it. */}
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
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
                    placeholder="you@example.com"
                    error={fieldErrors.email}
                    helperText="We’ll email you a 6-digit code. No password needed."
                />
                <TurnstileField ref={captcha} />
                <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    className="w-full !mt-6"
                    isLoading={isLoading}
                    disabled={!agreed}
                >
                    Continue with email
                </Button>
            </form>

            <p className="mt-6 text-sm leading-relaxed text-gray-600">
                Need blood for someone? You can {requestLink}.
            </p>
            <p className="mt-3 text-[13px] leading-relaxed text-gray-500">
                {PLATFORM_DISCLAIMER} Any arrangement is between you and the other person, at your own discretion.
            </p>
        </AuthFrame>
    );
}
