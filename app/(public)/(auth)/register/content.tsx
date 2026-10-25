"use client";

import { authedFetch } from '@/lib/api';
import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthFrame, authLinkClass } from '@/components/auth/AuthFrame';
import { Alert } from '@/components/ui/Alert';
import { supabase } from '@/lib/supabase';
import { PLATFORM_DISCLAIMER, consentStamp, hasRecordedConsent } from '@/lib/legal';
import type { User } from '@supabase/supabase-js';
import { rememberReferral } from '@/lib/referrals';
import { GoogleOption } from '@/components/auth/GoogleSignIn';
import { ContinueSignIn, type CodeSent } from '@/components/auth/ContinueSignIn';
import { PHONE_SIGNIN } from '@/lib/features';
import { useAuth } from '@/context/AuthContext';
import { cleanNext, pathAfterSignUp, rememberNext, withRedirect } from '@/lib/auth-helpers';

/**
 * Joining as a donor: "By continuing, you agree…", then one field for an email
 * or a mobile number (ContinueSignIn) and one Continue, with Google as a
 * smaller second option. A mobile number gets its code on WhatsApp, an email
 * by email. No password: the code proves the address or number and signs the
 * person in (a password can be added later in Settings). The same code signs
 * in an existing account, so a registered email or number here isn't a dead
 * end. Then the short donor form (/complete-registration).
 *
 * ?redirect= is where they were heading (e.g. offering to donate for a
 * request); it is carried through the donor form. ?ref= is a referral code.
 */
export default function RegisterPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [error, setError] = useState('');
    // Set once a code is on its way (the heading changes to match).
    const [codeSent, setCodeSent] = useState<CodeSent | null>(null);
    const [next, setNext] = useState('');
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

    // Only here to request blood? That needs no account up front.
    const requestLink = <Link href="/requests/new" className={authLinkClass}>post a request without an account</Link>;
    // Stored on the account when it is created (the database checks the consent).
    const signUpData = () => ({ registration_completed: false, ...consentStamp() });
    // Where the link in the email lands (the code entered here does the same).
    const emailLanding = () => `${window.location.origin}${withRedirect('/complete-registration', next)}`;

    // Google can't carry user metadata, so remember the consent locally;
    // complete-registration records it against the account.
    const rememberConsent = () => { try { localStorage.setItem('pendingConsent', JSON.stringify(consentStamp())); } catch { /* storage unavailable */ } };

    // Runs once the person has a session (email code or WhatsApp code).
    const finishSignUp = async (signedIn: User) => {
        // The database copies the sign-up consent onto a new profile. An
        // existing account signing in here has just agreed too (by continuing):
        // record it if there's nothing on record yet (best effort).
        const { data: profile } = await supabase.from('profiles')
            .select('consent_agreed, consent_at, consent_version').eq('id', signedIn.id).maybeSingle();
        if (!hasRecordedConsent(profile)) {
            await supabase.from('profiles').update(consentStamp()).eq('id', signedIn.id).then(() => {}, () => {});
        }
        // Welcome email to the signed-in user's own address (server-side; new accounts only).
        if (signedIn.email) authedFetch('/api/notify/welcome', { method: 'POST' }).catch(() => {});
        router.push(await pathAfterSignUp(signedIn.id, next));
    };

    // One tree for both steps, so the form keeps its state when the heading changes.
    return (
        <AuthFrame
            title={!codeSent ? 'Join Vital' : codeSent.via === 'email' ? 'Check your email' : 'Get your code on WhatsApp'}
            subtitle={codeSent
                ? 'Enter the 6-digit code. Then add your blood group and district, and you’re done.'
                : `Enter your ${PHONE_SIGNIN ? 'email or mobile number' : 'email'}, then add your blood group and district. It takes about a minute.`}
            footer={codeSent
                ? <>Already registered? The same code signs you in.</>
                : <>Already registered? <Link href={withRedirect('/login', next)} className={authLinkClass}>Sign in</Link></>}
        >
            {error && !codeSent && <Alert variant="error" className="mb-6">{error}</Alert>}

            {/* Continuing is the agreement: every way in below records it (when and which version). */}
            {!codeSent && (
                <p id="consent-note" className="mb-6 text-sm leading-relaxed text-gray-600">
                    By continuing, you agree to the <Link href="/terms" target="_blank" className={authLinkClass}>Terms</Link> and
                    confirm you have read the <Link href="/privacy" target="_blank" className={authLinkClass}>Privacy notice</Link>.
                </p>
            )}

            <ContinueSignIn
                purpose="join"
                onSignedIn={finishSignUp}
                // Checked by the Before User Created hook; copied onto the new profile.
                signUpData={signUpData}
                emailRedirectTo={emailLanding}
                // In case they open the link in the email instead of typing the code.
                beforeEmailCode={() => rememberNext(next)}
                registerHref={withRedirect('/register', next)}
                onCodeSent={(sent) => { setCodeSent(sent); setError(''); }}
            >
                <GoogleOption next={next} onBeforeSignIn={rememberConsent} onError={setError} />
            </ContinueSignIn>

            {!codeSent && (
                <>
                    <p className="mt-6 text-sm leading-relaxed text-gray-600">
                        Need blood for someone? You can {requestLink}.
                    </p>
                    <p className="mt-3 text-[13px] leading-relaxed text-gray-500">
                        {PLATFORM_DISCLAIMER} Any arrangement is between you and the other person, at your own discretion.
                    </p>
                </>
            )}
        </AuthFrame>
    );
}
