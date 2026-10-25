"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthFrame, authLinkClass } from '@/components/auth/AuthFrame';
import { Alert } from '@/components/ui/Alert';
import { useAuth } from '@/context/AuthContext';
import { cleanNext, pathAfterSignIn, withRedirect } from '@/lib/auth-helpers';
import { PHONE_SIGNIN } from '@/lib/features';
import { safeInternalPath } from '@/lib/site';
import { GoogleOption } from '@/components/auth/GoogleSignIn';
import { ContinueSignIn, type CodeSent } from '@/components/auth/ContinueSignIn';

/**
 * Signing in: one field for an email or a mobile number and one Continue
 * (ContinueSignIn: a code on WhatsApp or by email), "Use a password instead"
 * for email and password, and Google as a smaller second option. The same as
 * Join and the sign-in dialog. Once signed in, ?redirect= (or ?from=) is
 * honoured (lib/auth-helpers.ts pathAfterSignIn).
 */
export default function LoginPage() {
    const router = useRouter();
    const { user, session } = useAuth();
    const [error, setError] = useState('');
    const [redirect, setRedirect] = useState('');
    const [codeSent, setCodeSent] = useState<CodeSent | null>(null);

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

    const registerHref = withRedirect('/register', cleanNext(redirect));

    return (
        <AuthFrame
            title={!codeSent ? 'Sign in' : codeSent.via === 'email' ? 'Check your email' : 'Get your code on WhatsApp'}
            subtitle={codeSent ? undefined : PHONE_SIGNIN ? 'With the email or mobile number you registered with.' : 'With the email you registered with.'}
            footer={codeSent ? undefined : (
                <div className="flex flex-wrap justify-between gap-3">
                    <span>
                        New to Vital? <Link href={registerHref} className={authLinkClass}>Join in about a minute</Link>
                    </span>
                    <Link href="/forgot-password" className="text-gray-500 hover:text-gray-900">
                        Forgot password?
                    </Link>
                </div>
            )}
        >
            {error && !codeSent && <Alert variant="error" className="mb-6">{error}</Alert>}

            {/* Signing in updates the session; the effect above then routes them. */}
            <ContinueSignIn
                purpose="signin"
                onSignedIn={() => {}}
                registerHref={registerHref}
                onCodeSent={(sent) => { setCodeSent(sent); setError(''); }}
            >
                <GoogleOption
                    next={redirect}
                    onError={setError}
                    note={<>
                        New to Vital? Continuing with Google creates an account, and means you accept the{' '}
                        <Link href="/terms" className={authLinkClass}>Terms</Link> and{' '}
                        <Link href="/privacy" className={authLinkClass}>Privacy notice</Link>. You confirm this on the next screen.
                    </>}
                />
            </ContinueSignIn>
        </AuthFrame>
    );
}
