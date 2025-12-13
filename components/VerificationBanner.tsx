import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { Mail, Phone, X } from 'lucide-react';

export const VerificationBanner = () => {
    const { session, user } = useAuth();
    const [isVisible, setIsVisible] = useState(true);
    const [loading, setLoading] = useState<'email' | 'phone' | null>(null);
    const [sent, setSent] = useState<'email' | 'phone' | null>(null);
    const [error, setError] = useState<string>('');

    if (!session?.user || !isVisible) return null;

    const emailVerified = session.user.email_confirmed_at;
    const phoneVerified = session.user.phone_confirmed_at;

    // If both are verified (or phone is missing and email is verified), don't show
    if (emailVerified && (phoneVerified || !user?.phone)) return null;

    // Use user.phone (from profile) if session phone is missing
    const userPhone = user?.phone || session.user.phone;

    // Check if we really need to show this
    // If phone exists in profile but is not verified in auth
    const needsPhoneVerification = userPhone && !phoneVerified;

    if (!needsPhoneVerification && emailVerified) return null;

    const handleVerifyEmail = async () => {
        setLoading('email');
        setError('');
        try {
            const { error } = await supabase.auth.resend({
                type: 'signup',
                email: session.user.email!,
                options: {
                    emailRedirectTo: `${window.location.origin}/dashboard`
                }
            });
            if (error) throw error;
            setSent('email');
        } catch (err: any) {
            console.error('Error sending verification email:', err);
            setError(err.message || 'Failed to send verification email');
        } finally {
            setLoading(null);
        }
    };

    const handleVerifyPhone = async () => {
        // Phone verification via OTP usually requires a more complex UI (modal to enter code)
        // For this banner, we might just trigger the OTP send
        // But without an input field, user can't verify.
        // So maybe this button should redirect to profile?
        // Let's make it redirect to profile for now.
        window.location.href = '/profile';
    };

    return (
        <div className="bg-yellow-50 border-b border-yellow-200 p-4 relative">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex-1">
                    <h3 className="text-sm font-medium text-yellow-800 flex items-center gap-2">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-yellow-200 text-yellow-700 text-xs font-bold">!</span>
                        Account Verification
                    </h3>
                    <p className="mt-1 text-sm text-yellow-700">
                        {!emailVerified && needsPhoneVerification
                            ? "Please verify your email and phone number to secure your account."
                            : !emailVerified
                                ? "Please verify your email address to secure your account."
                                : "Please verify your phone number to secure your account."
                        }
                    </p>
                    {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
                    {sent === 'email' && <p className="mt-1 text-xs text-green-600">Verification email sent!</p>}
                </div>

                <div className="flex flex-wrap gap-2">
                    {!emailVerified && sent !== 'email' && (
                        <Button
                            size="sm"
                            variant="outline"
                            className="bg-white hover:bg-yellow-50 text-yellow-700 border-yellow-300"
                            onClick={handleVerifyEmail}
                            isLoading={loading === 'email'}
                            leftIcon={<Mail className="h-3 w-3" />}
                        >
                            Verify Email
                        </Button>
                    )}

                    {needsPhoneVerification && (
                        <Button
                            size="sm"
                            variant="outline"
                            className="bg-white hover:bg-yellow-50 text-yellow-700 border-yellow-300"
                            onClick={handleVerifyPhone}
                            leftIcon={<Phone className="h-3 w-3" />}
                        >
                            Verify Phone
                        </Button>
                    )}

                    <button
                        onClick={() => setIsVisible(false)}
                        className="text-yellow-500 hover:text-yellow-700 p-1"
                        aria-label="Dismiss"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>
            </div>
        </div>
    );
};
