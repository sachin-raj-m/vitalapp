"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PageLoader } from '@/components/PageLoader';
import { supabase } from '@/lib/supabase';
import { cleanNext, pathAfterSignIn, pathAfterSignUp, takeNext } from '@/lib/auth-helpers';
import { safeInternalPath } from '@/lib/site';

/**
 * Landing page after Google (both flows) and email links. Where to go next
 * comes from ?next= (Google's own button, password-reset links) or, for
 * Google's redirect flow, which can't carry it, from rememberNext().
 */
/** Came from Google on the Join page (it leaves the consent just ticked there): offer the donor form. */
const joining = () => {
    try {
        const pending = JSON.parse(localStorage.getItem('pendingConsent') || 'null');
        return !!pending?.consent_at && Date.now() - Date.parse(pending.consent_at) < 30 * 60 * 1000;
    } catch {
        return false;
    }
};

export default function AuthCallback() {
    const router = useRouter();

    useEffect(() => {
        const handleCallback = async () => {
            const params = new URLSearchParams(window.location.search);
            // e.g. a password-reset link sends people to /profile/edit.
            const next = safeInternalPath(params.get('next'), '') || takeNext();
            // Google reports a cancelled or failed sign-in in the URL (query or hash).
            const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
            const failed = params.get('error') || hash.get('error');
            const toLogin = () => {
                const query = new URLSearchParams();
                if (failed) query.set('google', 'failed');
                if (cleanNext(next)) query.set('redirect', cleanNext(next));
                const q = query.toString();
                router.replace(q ? `/login?${q}` : '/login');
            };
            try {
                const { data: { session }, error } = await supabase.auth.getSession();
                if (error) throw error;
                if (!session) {
                    toLogin();
                    return;
                }
                router.replace(joining()
                    ? await pathAfterSignUp(session.user.id, next)
                    : await pathAfterSignIn(session.user.id, session.user.user_metadata, next));
            } catch (error) {
                console.error('Auth callback error:', error);
                toLogin();
            }
        };

        handleCallback();
    }, [router]);

    return (
        <PageLoader label="Signing you in…" />
    );
}
