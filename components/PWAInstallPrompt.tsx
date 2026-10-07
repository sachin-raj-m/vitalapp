"use client";

import React, { useEffect, useRef, useState } from 'react';
import { X, Share, PlusSquare } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { usePathname } from 'next/navigation';

const DISMISS_KEY = 'pwa_prompt_dismissed';
const IOS_SHOWN_KEY = 'pwa_prompt_ios_shown';
const DELAY_MS = 20000;

// In-memory fallback for when storage throws (Safari private mode, blocked
// site data), so a dismissal still holds for the rest of this page session.
let dismissedInMemory = false;

const wasDismissed = () => {
    if (dismissedInMemory) return true;
    try { return localStorage.getItem(DISMISS_KEY) === 'true'; } catch { return true; }
};
const rememberDismissed = () => {
    dismissedInMemory = true;
    try { localStorage.setItem(DISMISS_KEY, 'true'); } catch { /* ignore */ }
};

const isStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;

// Allow-list: only pages where the user is browsing, with no forms or
// destructive controls at the bottom. Exact matches, so /requests/new,
// /requests/[id], /profile etc. never get the banner.
const SHOWN_ON = new Set(['/', '/requests', '/how-it-works', '/dashboard']);
const isAllowedPath = (pathname: string | null) =>
    !!pathname && SHOWN_ON.has(pathname.replace(/\/+$/, '') || '/');

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallPrompt() {
    const pathname = usePathname();
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    // `ready` means the delay has passed and the device can install; the
    // banner itself only renders on allowed pages and while not dismissed.
    const [ready, setReady] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const barRef = useRef<HTMLDivElement>(null);
    const [barHeight, setBarHeight] = useState(0);

    useEffect(() => {
        if (isStandalone() || wasDismissed()) {
            setDismissed(true);
            return;
        }

        const timers: number[] = [];
        const ua = navigator.userAgent;
        const isIosDevice =
            (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) &&
            !(window as unknown as { MSStream?: unknown }).MSStream;
        setIsIOS(isIosDevice);

        const markReady = () => {
            // Re-check at the moment of showing: the user may have dismissed in
            // another tab, or installed, since this timer was scheduled.
            if (wasDismissed() || isStandalone()) {
                setDismissed(true);
                return;
            }
            setReady(true);
        };

        if (isIosDevice) {
            // iOS has no install event; offer instructions once per session.
            let shownThisSession = false;
            try { shownThisSession = sessionStorage.getItem(IOS_SHOWN_KEY) === 'true'; } catch { /* ignore */ }
            if (!shownThisSession) timers.push(window.setTimeout(markReady, DELAY_MS));
        }

        let scheduled = false;
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            if (wasDismissed()) return;
            setDeferredPrompt(e as BeforeInstallPromptEvent);
            // Chromium can fire this more than once; schedule only one timer.
            if (scheduled) return;
            scheduled = true;
            timers.push(window.setTimeout(markReady, DELAY_MS));
        };

        const handleInstalled = () => {
            rememberDismissed();
            setDismissed(true);
            setDeferredPrompt(null);
        };

        // Dismissal in another tab hides the banner here too.
        const handleStorage = (e: StorageEvent) => {
            if (e.key === DISMISS_KEY && e.newValue === 'true') {
                dismissedInMemory = true;
                setDismissed(true);
            }
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.addEventListener('appinstalled', handleInstalled);
        window.addEventListener('storage', handleStorage);
        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', handleInstalled);
            window.removeEventListener('storage', handleStorage);
            timers.forEach(t => window.clearTimeout(t));
        };
    }, []);

    const canInstall = isIOS || !!deferredPrompt;
    const visible = ready && !dismissed && canInstall && isAllowedPath(pathname);

    // iOS: count the session's one showing only once it has actually appeared.
    useEffect(() => {
        if (!visible || !isIOS) return;
        try { sessionStorage.setItem(IOS_SHOWN_KEY, 'true'); } catch { /* ignore */ }
    }, [visible, isIOS]);

    // Reserve the bar's height at the end of the page so it never sits over
    // the last content or buttons once the user scrolls to the bottom.
    useEffect(() => {
        const el = barRef.current;
        if (!visible || !el) { setBarHeight(0); return; }
        const update = () => setBarHeight(el.offsetHeight);
        update();
        if (typeof ResizeObserver === 'undefined') return;
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, [visible]);

    const dismiss = () => {
        // Explicit dismissal is permanent for this browser: the user said no,
        // and re-asking later is exactly what the QA report flagged.
        rememberDismissed();
        setDismissed(true);
    };

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        const promptEvent = deferredPrompt;
        setDeferredPrompt(null); // a deferred prompt can only be used once
        // Whatever the outcome (installed, or declined in the browser's own
        // dialog), don't offer again.
        dismiss();
        try {
            await promptEvent.prompt();
            await promptEvent.userChoice;
        } catch { /* ignore */ }
    };

    if (!visible) return null;

    return (
        <>
            <div aria-hidden="true" style={{ height: barHeight }} className="shrink-0" />
            <div
                ref={barRef}
                role="region"
                aria-label="Install Vital"
                className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85 pb-[env(safe-area-inset-bottom)] motion-safe:animate-fade-up"
            >
                <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5">
                    <img src="/icons/icon-192x192.png" alt="" className="h-7 w-7 shrink-0 rounded-md" />
                    <div className="min-w-0 flex-1 text-sm text-gray-700">
                        <span className="font-medium text-gray-900">Add Vital to your home screen</span>
                        {isIOS ? (
                            <span className="block text-xs text-gray-600 sm:inline sm:ml-2">
                                Tap <Share size={13} className="inline -mt-0.5" aria-label="Share" /> then{' '}
                                <PlusSquare size={13} className="inline -mt-0.5" aria-hidden="true" />{' '}
                                <strong>Add to Home Screen</strong>
                            </span>
                        ) : (
                            <span className="hidden text-gray-600 sm:inline sm:ml-2">
                                so alerts reach you when someone needs blood.
                            </span>
                        )}
                    </div>
                    {!isIOS && (
                        <Button size="sm" variant="ink" className="shrink-0" onClick={handleInstallClick}>
                            Install
                        </Button>
                    )}
                    <button
                        type="button"
                        onClick={dismiss}
                        className="shrink-0 rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                        aria-label="Dismiss install banner"
                    >
                        <X size={18} aria-hidden="true" />
                    </button>
                </div>
            </div>
        </>
    );
}
