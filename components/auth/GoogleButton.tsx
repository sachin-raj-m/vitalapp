import React from 'react';
import { Button } from '@/components/ui/Button';

const GoogleMark = () => (
    <svg viewBox="0 0 18 18" className="h-4 w-4" aria-hidden>
        <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
        <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
        <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z" />
        <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
    </svg>
);

export function GoogleButton({ onClick, isLoading }: { onClick: () => void; isLoading?: boolean }) {
    return (
        <Button type="button" variant="secondary" size="lg" className="w-full" onClick={onClick} isLoading={isLoading} leftIcon={<GoogleMark />}>
            Continue with Google
        </Button>
    );
}

export function OrDivider() {
    return (
        <div className="my-6 flex items-center gap-3" role="separator">
            <span className="h-px flex-1 bg-gray-200" />
            <span className="eyebrow">or</span>
            <span className="h-px flex-1 bg-gray-200" />
        </div>
    );
}

export function friendlyAuthError(message?: string) {
    if (!message) return 'Something went wrong. Please try again.';
    if (message.includes('Invalid login credentials')) return 'That email and password don’t match.';
    if (message.includes('Email not confirmed')) return 'Please confirm your email address before signing in.';
    if (message.includes('User already registered')) return 'An account with this email already exists.';
    return message;
}
