"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogIn } from 'lucide-react';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { isRegistrationComplete } from '@/lib/auth-helpers';

export default function LoginPage() {
    const router = useRouter();
    const { signIn, user } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);

    useEffect(() => {
        const checkUserRegistration = async () => {
            if (user) {

                try {
                    const isComplete = await isRegistrationComplete(user.id);


                    if (!isComplete) {

                        // Store basic info for registration completion
                        const pendingData = {
                            userId: user.id,
                            email: user.email,
                            phone: user.phone || ''
                        };

                        localStorage.setItem('pendingRegistration', JSON.stringify(pendingData));
                        router.push('/complete-registration');
                    } else {

                        router.push('/dashboard');
                    }
                } catch (err) {
                    console.error('Error in registration check');
                    // On error, we'll treat it as incomplete registration
                    const pendingData = {
                        userId: user.id,
                        email: user.email,
                        phone: user.phone || ''
                    };
                    localStorage.setItem('pendingRegistration', JSON.stringify(pendingData));
                    router.push('/complete-registration');
                }
            }
        };

        checkUserRegistration();
    }, [user, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            await signIn(email, password);
            // The navigation will be handled by the useEffect above
        } catch (err: any) {
            if (err.message.includes('Invalid login credentials')) {
                setError('Invalid email or password');
            } else if (err.message.includes('Email not confirmed')) {
                setError('Please verify your email address before signing in');
            } else {
                setError(err.message || 'An error occurred during sign in');
            }
            setIsLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setIsGoogleLoading(true);
        setError('');
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/auth/callback`,
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'consent',
                    },
                },
            });

            if (error) {
                throw error;
            }
        } catch (err: any) {
            console.error('Google sign in error');
            setError(err.message || 'Failed to sign in with Google');
            setIsGoogleLoading(false);
        }
    };

    return (
        <div className="max-w-md mx-auto">
            <Card>
                <CardHeader>
                    <h1 className="text-2xl font-bold text-center text-gray-900">Welcome Back</h1>
                    <p className="text-center text-gray-600 mt-2">Sign in to continue to your account</p>
                </CardHeader>
                <CardBody>
                    {error && (
                        <Alert variant="error" className="mb-4">
                            {error}
                        </Alert>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <Input
                            label="Email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoComplete="email"
                        />
                        <Input
                            label="Password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            autoComplete="current-password"
                        />

                        <Button
                            type="submit"
                            variant="primary"
                            className="w-full"
                            isLoading={isLoading}
                            leftIcon={<LogIn className="h-5 w-5" />}
                        >
                            Sign In
                        </Button>
                    </form>

                    <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-300"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-white text-gray-500">Or continue with</span>
                        </div>
                    </div>

                    <Button
                        type="button"
                        variant="secondary"
                        className="w-full"
                        onClick={handleGoogleSignIn}
                        isLoading={isGoogleLoading}
                    >
                        Sign in with Google
                    </Button>

                    <div className="mt-6 text-center space-y-2">
                        <p className="text-sm text-gray-600">
                            <Link href="/forgot-password" className="text-primary-500 hover:text-primary-600">
                                Forgot your password?
                            </Link>
                        </p>
                        <p className="text-sm text-gray-600">
                            Don't have an account?{' '}
                            <Link href="/register" className="text-primary-500 hover:text-primary-600">
                                Sign up
                            </Link>
                        </p>
                    </div>
                </CardBody>
            </Card>
        </div>
    );
}
