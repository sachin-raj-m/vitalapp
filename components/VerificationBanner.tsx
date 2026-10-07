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
            console.error('Error sending verification email');
            setError(err.message || 'Couldn’t send the verification email. Please try again.');
        } finally {
            setLoading(null);
        }
    };

    const handleVerifyPhone = async () => {
        // Redirect to profile edit page where user can update and verify phone
        window.location.href = '/profile/edit';
    };

    const message = !emailVerified && needsPhoneVerification
        ? 'Please verify your email address and phone number.'
        : !emailVerified
            ? 'Please verify your email address.'
            : 'Please verify your phone number.';

    return (
        <div className="flex flex-col gap-3 rounded-md border-l-2 border-warning-500 bg-warning-50 px-4 py-3 text-sm sm:flex-row sm:items-center">
            <div className="flex-1 text-warning-800">
                <p>{message}</p>
                {error && <p className="mt-1 text-[13px] text-red-700">{error}</p>}
                {sent === 'email' && <p className="mt-1 text-[13px] text-success-700">Verification email sent. Check your inbox.</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
                {!emailVerified && sent !== 'email' && (
                    <Button size="sm" variant="secondary" onClick={handleVerifyEmail} isLoading={loading === 'email'} leftIcon={<Mail className="h-3.5 w-3.5" />}>
                        Send verification email
                    </Button>
                )}
                {needsPhoneVerification && (
                    <Button size="sm" variant="secondary" onClick={handleVerifyPhone} leftIcon={<Phone className="h-3.5 w-3.5" />}>
                        Verify phone
                    </Button>
                )}
                <button onClick={() => setIsVisible(false)} className="rounded p-1 text-warning-600 hover:text-warning-800" aria-label="Dismiss">
                    <X className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
};
