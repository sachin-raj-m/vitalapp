"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PageLoader } from '@/components/PageLoader';
import { supabase } from '@/lib/supabase';
import { isRegistrationComplete } from '@/lib/auth-helpers';
import { safeInternalPath } from '@/lib/site';

export default function AuthCallback() {
    const router = useRouter();

    useEffect(() => {
        const handleCallback = async () => {
            try {
                const { data: { session }, error } = await supabase.auth.getSession();
                if (error) throw error;
                if (!session) {
                    router.push('/login');
                    return;
                }

                // Check if user has completed registration
                const isComplete = await isRegistrationComplete(session.user.id);

                if (!isComplete) {
                    // Store basic info in localStorage for completing registration
                    localStorage.setItem('pendingRegistration', JSON.stringify({
                        userId: session.user.id,
                        email: session.user.email,
                        phone: session.user.phone || ''
                    }));
                    router.push('/complete-registration');
                } else {
                    // e.g. a password-reset link sends people to /profile/edit.
                    const next = new URLSearchParams(window.location.search).get('next');
                    router.push(safeInternalPath(next));
                }
            } catch (error) {
                console.error('Auth callback error:', error);
                router.push('/login');
            }
        };

        handleCallback();
    }, [router]);

    return (
        <PageLoader label="Signing you in…" />
    );
}
