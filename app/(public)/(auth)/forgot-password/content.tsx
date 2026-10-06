"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { AuthFrame, authLinkClass } from '@/components/auth/AuthFrame';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { supabase } from '@/lib/supabase';

export default function ForgotPasswordContent() {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            // Using Custom Recovery API to send template via SMTP
            const response = await fetch('/api/auth/recovery', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to send reset email');
            }



            setIsSuccess(true);
        } catch (err: any) {
            console.error('Password reset error', err);
            setError(err.message || 'Failed to send reset email. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    if (isSuccess) {
        return (
            <AuthFrame
                eyebrow="Check your inbox"
                title={<>Link <em>sent.</em></>}
                subtitle={<>If an account exists for <span className="text-gray-900">{email}</span>, a reset link is on its way. It can take a few minutes, so check spam too.</>}
                footer={<Link href="/login" className={authLinkClass}>Back to sign in</Link>}
            >
                {null}
            </AuthFrame>
        );
    }

    return (
        <AuthFrame
            eyebrow="Reset password"
            title={<>Forgot it? <em>Happens.</em></>}
            subtitle="Enter the email you registered with and we’ll send you a reset link."
            footer={<Link href="/login" className={authLinkClass}>Back to sign in</Link>}
        >
            {error && <Alert variant="error" className="mb-6">{error}</Alert>}
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
                <Button type="submit" variant="ink" size="lg" className="w-full !mt-6" isLoading={isLoading}>
                    Send reset link
                </Button>
            </form>
        </AuthFrame>
    );
}
