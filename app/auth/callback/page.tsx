"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PageLoader } from '@/components/PageLoader';
import { supabase } from '@/lib/supabase';
import { pathAfterSignIn } from '@/lib/auth-helpers';
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

                // e.g. a password-reset link sends people to /profile/edit.
                const next = safeInternalPath(new URLSearchParams(window.location.search).get('next'), '');
                router.push(await pathAfterSignIn(session.user.id, session.user.user_metadata, next));
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
