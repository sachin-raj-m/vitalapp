"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { Modal } from '@/components/ui/Modal';
import { GoogleButton, OrDivider, friendlyAuthError } from '@/components/auth/GoogleButton';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    message?: string;
}

export function AuthModal({ isOpen, onClose, onSuccess, message = "Sign in to continue" }: AuthModalProps) {
    const { signIn } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            await signIn(email, password);
            onSuccess();
        } catch (err: any) {
            setError(friendlyAuthError(err?.message));
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setIsGoogleLoading(true);
        setError('');
        try {
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

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={message}>
            {error && <Alert variant="error" className="mb-5">{error}</Alert>}

            <form onSubmit={handleSubmit} className="space-y-4">
                <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
                <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
                <Button type="submit" variant="ink" size="lg" className="w-full" isLoading={isLoading}>
                    Sign in
                </Button>
            </form>

            <OrDivider />
            <GoogleButton onClick={handleGoogleSignIn} isLoading={isGoogleLoading} />

            <p className="mt-6 text-center text-sm text-gray-600">
                New here?{' '}
                <Link href="/register" className="font-medium text-gray-900 underline decoration-gray-300 underline-offset-4 hover:decoration-gray-900">
                    Create an account
                </Link>
            </p>
        </Modal>
    );
}
