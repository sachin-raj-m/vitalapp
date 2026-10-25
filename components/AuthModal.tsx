"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { Alert } from '@/components/ui/Alert';
import { Modal } from '@/components/ui/Modal';
import { withRedirect } from '@/lib/auth-helpers';
import { GoogleOption } from '@/components/auth/GoogleSignIn';
import { ContinueSignIn, type CodeSent } from '@/components/auth/ContinueSignIn';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    message?: string;
    /** Where to come back to when signing in leaves the page (Google, Join). */
    next?: string;
}

/**
 * Sign in without leaving the page, the same way as the sign-in page: one
 * field for an email or a mobile number and one Continue (ContinueSignIn),
 * "Use a password instead", and Google as a smaller second option. New
 * people are pointed to Join, which brings them back to `next`.
 */
export function AuthModal({ isOpen, onClose, onSuccess, message = "Sign in to continue", next }: AuthModalProps) {
    const [error, setError] = useState('');
    const [codeSent, setCodeSent] = useState<CodeSent | null>(null);

    const registerHref = withRedirect('/register', next);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={message}>
            {error && !codeSent && <Alert variant="error" className="mb-5">{error}</Alert>}

            <ContinueSignIn
                purpose="signin"
                onSignedIn={() => onSuccess()}
                registerHref={registerHref}
                onCodeSent={(sent) => { setCodeSent(sent); setError(''); }}
            >
                <GoogleOption next={next} onError={setError} />
            </ContinueSignIn>

            {!codeSent && (
                <p className="mt-6 text-center text-sm text-gray-600">
                    New here?{' '}
                    <Link href={registerHref} className="font-medium text-gray-900 underline decoration-gray-300 underline-offset-4 hover:decoration-gray-900">
                        Join in about a minute
                    </Link>
                </p>
            )}
        </Modal>
    );
}
