"use client";

import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

/**
 * Cloudflare Turnstile bot check for sign-up, sign-in, email codes and password
 * reset. Invisible for most people ("interaction-only"): a checkbox appears only
 * when Cloudflare needs one. Supabase Auth verifies the token itself once captcha
 * is switched on (Auth settings > Bot and abuse protection); the password reset
 * route verifies it with Cloudflare (lib/turnstile.ts).
 *
 * Off when NEXT_PUBLIC_TURNSTILE_SITE_KEY isn't set: getToken() returns undefined.
 *
 * Usage: const captcha = useRef<TurnstileHandle>(null); ... await captcha.current?.getToken()
 */
export type TurnstileHandle = {
    /** A fresh token, waiting for the check if needed. Tokens work once. */
    getToken: () => Promise<string | undefined>;
    /** Call after each submit so the next attempt gets a new token. */
    reset: () => void;
};

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

type TurnstileApi = {
    render: (el: HTMLElement, opts: Record<string, unknown>) => string;
    reset: (id: string) => void;
    remove: (id: string) => void;
};
declare global { interface Window { turnstile?: TurnstileApi } }

let scriptPromise: Promise<void> | null = null;
function loadScript(): Promise<void> {
    if (window.turnstile) return Promise.resolve();
    scriptPromise ??= new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = SCRIPT_SRC;
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => { scriptPromise = null; reject(new Error('Turnstile failed to load')); };
        document.head.appendChild(s);
    });
    return scriptPromise;
}

export const TurnstileField = forwardRef<TurnstileHandle, { className?: string }>(function TurnstileField({ className }, ref) {
    const box = useRef<HTMLDivElement>(null);
    const widgetId = useRef<string | null>(null);
    const token = useRef<string | null>(null);
    const waiters = useRef<Array<(t: string | undefined) => void>>([]);
    const [failed, setFailed] = useState(false);

    const settle = (t: string | undefined) => {
        waiters.current.splice(0).forEach(resolve => resolve(t));
    };

    useEffect(() => {
        if (!SITE_KEY) return;
        let cancelled = false;
        loadScript().then(() => {
            if (cancelled || !box.current || !window.turnstile) return;
            widgetId.current = window.turnstile.render(box.current, {
                sitekey: SITE_KEY,
                appearance: 'interaction-only',
                theme: 'light', // the site has no dark mode
                size: 'flexible',
                callback: (t: string) => { token.current = t; setFailed(false); settle(t); },
                'expired-callback': () => { token.current = null; },
                'error-callback': () => { token.current = null; setFailed(true); settle(undefined); return true; },
            });
        }).catch(() => { setFailed(true); settle(undefined); });
        return () => {
            cancelled = true;
            if (widgetId.current) window.turnstile?.remove(widgetId.current);
            widgetId.current = null;
        };
    }, []);

    useImperativeHandle(ref, () => ({
        getToken() {
            if (!SITE_KEY) return Promise.resolve(undefined);
            if (token.current) return Promise.resolve(token.current);
            // Wait for the check (at most 20 seconds), then let the form submit
            // anyway: Supabase gives a clear error if a token was required.
            return new Promise(resolve => {
                waiters.current.push(resolve);
                setTimeout(() => resolve(token.current ?? undefined), 20_000);
            });
        },
        reset() {
            token.current = null;
            if (widgetId.current) window.turnstile?.reset(widgetId.current);
        },
    }), []);

    if (!SITE_KEY) return null;
    return (
        <div className={className}>
            <div ref={box} />
            {failed && (
                <p className="text-[13px] text-red-700" role="alert">
                    The security check couldn’t load. Check your connection or turn off content blockers for this site, then try again.
                </p>
            )}
        </div>
    );
});
