"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Mail } from 'lucide-react';
import { toast } from 'sonner';

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
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/auth/callback?next=/dashboard/profile`,
            });

            if (resetError) {
                throw resetError;
            }

            setIsSuccess(true);
            toast.success("Password reset email sent!");
        } catch (err: any) {
            console.error('Password reset error', err);
            setError(err.message || 'Failed to send reset email. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-md mx-auto">
            <Card>
                <CardHeader>
                    <h1 className="text-2xl font-bold text-center text-gray-900">Reset Password</h1>
                    <p className="text-center text-gray-600 mt-2">
                        Enter your email to receive a password reset link.
                    </p>
                </CardHeader>
                <CardBody>
                    {isSuccess ? (
                        <div className="text-center space-y-4">
                            <div className="flex justify-center">
                                <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                                    <Mail className="h-6 w-6" />
                                </div>
                            </div>
                            <Alert variant="success">
                                Check your email for a link to reset your password. If it doesn't appear within a few minutes, check your spam folder.
                            </Alert>
                            <Link href="/login">
                                <Button variant="secondary" className="w-full mt-4">
                                    Back to Login
                                </Button>
                            </Link>
                        </div>
                    ) : (
                        <>
                            {error && (
                                <Alert variant="error" className="mb-4">
                                    {error}
                                </Alert>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <Input
                                    label="Email Address"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    autoComplete="email"
                                    placeholder="Enter your registered email"
                                />

                                <Button
                                    type="submit"
                                    variant="primary"
                                    className="w-full"
                                    isLoading={isLoading}
                                >
                                    Send Reset Link
                                </Button>
                            </form>
                        </>
                    )}

                    <div className="mt-6 text-center">
                        <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900 flex items-center justify-center gap-1">
                            <ArrowLeft className="h-4 w-4" /> Back to Login
                        </Link>
                    </div>
                </CardBody>
            </Card>
        </div>
    );
}
