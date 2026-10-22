"use client";

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { Alert } from '@/components/ui/Alert';
import { Modal } from '@/components/ui/Modal';
import { OrDivider, friendlyAuthError } from '@/components/auth/GoogleButton';
import { supabase } from '@/lib/supabase';
import { rememberNext, withRedirect } from '@/lib/auth-helpers';
import { TurnstileField, type TurnstileHandle } from '@/components/TurnstileField';
import { GoogleSignIn } from '@/components/auth/GoogleSignIn';
import { WhatsAppSignIn } from '@/components/auth/WhatsAppSignIn';
import { EmailSignIn } from '@/components/auth/EmailSignIn';
import { PHONE_SIGNIN } from '@/lib/features';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    message?: string;
    /** Where to come back to when signing in leaves the page (Google, Join). */
    next?: string;
}

/**
 * Sign in without leaving the page: the same choices, in the same order, as
 * the sign-in page (Google, WhatsApp when switched on, email with a password
 * or a code). New people are pointed to Join, which brings them back to `next`.
 */
export function AuthModal({ isOpen, onClose, onSuccess, message = "Sign in to continue", next }: AuthModalProps) {
    const [error, setError] = useState('');
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const captcha = useRef<TurnstileHandle>(null);

    const handleGoogleSignIn = async () => {
        setIsGoogleLoading(true);
        setError('');
        try {
            // Google's redirect can't carry where to return; /auth/callback picks it up.
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

    const registerHref = withRedirect('/register', next);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={message}>
            {error && <Alert variant="error" className="mb-5">{error}</Alert>}

            <GoogleSignIn
                next={next}
                onFallback={handleGoogleSignIn}
                fallbackLoading={isGoogleLoading}
                getCaptchaToken={async () => { const t = await captcha.current?.getToken(); captcha.current?.reset(); return t; }}
                onError={message => setError(friendlyAuthError(message))}
            />
            <TurnstileField ref={captcha} />
            {PHONE_SIGNIN && (
                <div className="mt-4">
                    <WhatsAppSignIn onSignedIn={() => onSuccess()} />
                </div>
            )}

            <OrDivider />
            <EmailSignIn onSignedIn={onSuccess} registerHref={registerHref} />

            <p className="mt-6 text-center text-sm text-gray-600">
                New here?{' '}
                <Link href={registerHref} className="font-medium text-gray-900 underline decoration-gray-300 underline-offset-4 hover:decoration-gray-900">
                    Join in about a minute
                </Link>
            </p>
        </Modal>
    );
}
