"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { rememberNext } from '@/lib/auth-helpers';
import { GoogleButton, OrDivider, friendlyAuthError } from '@/components/auth/GoogleButton';
import { TurnstileField, type TurnstileHandle } from '@/components/TurnstileField';

/**
 * "Continue with Google" using Google's own button (Google Identity Services).
 *
 * Google's account screen then shows vitalapp.in (the page's own origin)
 * instead of the Supabase project address that the redirect flow shows. Google
 * hands back an ID token, which is exchanged for a Supabase session with
 * signInWithIdToken. A one-time nonce stops replayed tokens.
 *
 * Falls back to the redirect flow (onFallback) when NEXT_PUBLIC_GOOGLE_CLIENT_ID
 * isn't set or Google's script can't load.
 */
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

type GoogleId = {
    initialize: (opts: Record<string, unknown>) => void;
    renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
};
declare global { interface Window { google?: { accounts?: { id?: GoogleId } } } }

let scriptPromise: Promise<void> | null = null;
function loadScript(): Promise<void> {
    if (window.google?.accounts?.id) return Promise.resolve();
    scriptPromise ??= new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = SCRIPT_SRC;
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => { scriptPromise = null; reject(new Error('Google sign-in failed to load')); };
        document.head.appendChild(s);
    });
    return scriptPromise;
}

const randomNonce = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
};
const sha256Hex = async (value: string) => {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
};

/** /auth/callback, carrying where to go next. Also the redirect flow's return address (with the origin). */
export const authCallbackPath = (next?: string | null) =>
    next ? `/auth/callback?next=${encodeURIComponent(next)}` : '/auth/callback';

export function GoogleSignIn({
    onFallback,
    fallbackLoading,
    getCaptchaToken,
    onError,
    onBeforeSignIn,
    disabled,
    next,
}: {
    /** The redirect flow, used when Google's own button isn't available. */
    onFallback: () => void;
    fallbackLoading?: boolean;
    /** Turnstile token (Supabase checks captcha on this sign-in too). */
    getCaptchaToken?: () => Promise<string | undefined>;
    onError?: (message: string) => void;
    /** Runs just before the session is created (e.g. remember consent). */
    onBeforeSignIn?: () => void;
    /** Shown as an inactive button (e.g. until the consent box is ticked). */
    disabled?: boolean;
    /** Where to go once signed in (passed to /auth/callback). */
    next?: string;
}) {
    const router = useRouter();
    const box = useRef<HTMLDivElement>(null);
    const [mode, setMode] = useState<'loading' | 'google' | 'fallback'>(CLIENT_ID ? 'loading' : 'fallback');
    const [busy, setBusy] = useState(false);
    // Latest callbacks without re-initialising Google's button.
    const handlers = useRef({ getCaptchaToken, onError, onBeforeSignIn, next });
    useEffect(() => { handlers.current = { getCaptchaToken, onError, onBeforeSignIn, next }; });

    useEffect(() => {
        if (!CLIENT_ID || disabled) return;
        let cancelled = false;
        const rawNonce = randomNonce();

        (async () => {
            try {
                await loadScript();
                const gid = window.google?.accounts?.id;
                if (cancelled || !box.current || !gid) return;
                gid.initialize({
                    client_id: CLIENT_ID,
                    nonce: await sha256Hex(rawNonce),
                    ux_mode: 'popup',
                    use_fedcm_for_button: true,
                    callback: async ({ credential }: { credential: string }) => {
                        setBusy(true);
                        try {
                            handlers.current.onBeforeSignIn?.();
                            const captchaToken = await handlers.current.getCaptchaToken?.();
                            const { error } = await supabase.auth.signInWithIdToken({
                                provider: 'google',
                                token: credential,
                                nonce: rawNonce,
                                options: { captchaToken },
                            });
                            if (error) throw error;
                            router.push(authCallbackPath(handlers.current.next));
                        } catch (err) {
                            setBusy(false);
                            handlers.current.onError?.(err instanceof Error ? err.message : 'Google sign-in failed. Please try again.');
                        }
                    },
                });
                const width = Math.min(400, Math.max(200, box.current.offsetWidth || 320));
                gid.renderButton(box.current, {
                    type: 'standard', theme: 'outline', size: 'large', text: 'continue_with',
                    shape: 'rectangular', logo_alignment: 'center', width,
                });
                setMode('google');
            } catch {
                if (!cancelled) setMode('fallback');
            }
        })();
        return () => { cancelled = true; };
    }, [disabled, router]);

    if (mode === 'fallback' || disabled) {
        return <GoogleButton onClick={onFallback} isLoading={fallbackLoading} />;
    }
    return (
        <div className="relative">
            {/* Google renders its button into this box. */}
            <div ref={box} className="flex min-h-[44px] w-full justify-center" aria-busy={busy} />
            {(mode === 'loading' || busy) && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-md border border-gray-300 bg-white text-sm text-gray-500">
                    {busy ? 'Signing you in…' : 'Loading Google sign-in…'}
                </div>
            )}
        </div>
    );
}

/**
 * Google as the secondary way in, under ContinueSignIn's one field: an "or"
 * line, then Google's button (or the redirect flow when it can't load), with
 * its own captcha. `next` is where to go once signed in; onBeforeSignIn runs
 * before either flow (e.g. Join remembers the consent: Google can't carry
 * user metadata).
 */
export function GoogleOption({
    next,
    onBeforeSignIn,
    onError,
    note,
}: {
    next?: string;
    onBeforeSignIn?: () => void;
    onError: (message: string) => void;
    /** Small print under the button. */
    note?: React.ReactNode;
}) {
    const captcha = useRef<TurnstileHandle>(null);
    const [redirecting, setRedirecting] = useState(false);

    const redirectFlow = async () => {
        setRedirecting(true);
        try {
            onBeforeSignIn?.();
            // Google's redirect can't carry ?redirect=; /auth/callback picks it up.
            rememberNext(next);
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                // No forced consent screen: returning people go straight back in.
                options: { redirectTo: `${window.location.origin}/auth/callback` },
            });
            if (error) throw error;
        } catch (err) {
            onError(friendlyAuthError(err instanceof Error ? err.message : undefined));
            setRedirecting(false);
        }
    };

    return (
        <div>
            <OrDivider />
            <GoogleSignIn
                next={next}
                onFallback={redirectFlow}
                fallbackLoading={redirecting}
                getCaptchaToken={async () => { const t = await captcha.current?.getToken(); captcha.current?.reset(); return t; }}
                onBeforeSignIn={onBeforeSignIn}
                onError={message => onError(friendlyAuthError(message))}
            />
            <TurnstileField ref={captcha} />
            {note && <p className="mt-3 text-[13px] leading-relaxed text-gray-500">{note}</p>}
        </div>
    );
}
