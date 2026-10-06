"use client";

import React, { useEffect, useState } from 'react';
import { X, Share, PlusSquare } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { usePathname } from 'next/navigation';

const DISMISS_KEY = 'pwa_prompt_dismissed';

// Storage can throw (Safari private mode, blocked site data).
const wasDismissed = () => {
    try { return localStorage.getItem(DISMISS_KEY) === 'true'; } catch { return true; }
};
const rememberDismissed = () => {
    try { localStorage.setItem(DISMISS_KEY, 'true'); } catch { /* ignore */ }
};

// Pages where an install banner would cover a form or a shared card.
const HIDDEN_ON = ['/login', '/register', '/forgot-password', '/complete-registration', '/donor', '/requests/new'];

export function PWAInstallPrompt() {
    const pathname = usePathname();
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [showPrompt, setShowPrompt] = useState(false);
    const [isIOS, setIsIOS] = useState(false);

    useEffect(() => {
        if (window.matchMedia('(display-mode: standalone)').matches || wasDismissed()) return;

        const timers: number[] = [];
        const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
        setIsIOS(isIosDevice);

        if (isIosDevice) {
            // iOS has no install event; show instructions once per session.
            let shownThisSession = false;
            try { shownThisSession = sessionStorage.getItem(DISMISS_KEY) === 'shown'; } catch { /* ignore */ }
            if (!shownThisSession) {
                timers.push(window.setTimeout(() => {
                    setShowPrompt(true);
                    try { sessionStorage.setItem(DISMISS_KEY, 'shown'); } catch { /* ignore */ }
                }, 20000));
            }
        }

        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e);
            // Give first-time visitors a moment with the page before asking.
            timers.push(window.setTimeout(() => setShowPrompt(true), 20000));
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            timers.forEach(t => window.clearTimeout(t));
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setDeferredPrompt(null);
            rememberDismissed();
        }
        setShowPrompt(false);
    };

    const handleDismiss = () => {
        setShowPrompt(false);
        rememberDismissed();
    };

    if (HIDDEN_ON.some(p => pathname?.startsWith(p))) return null;
    if (!showPrompt) return null;

    return (
        <div role="region" aria-label="Install Vital" className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96 rounded-lg border border-gray-200 bg-white p-4 shadow-[0_8px_30px_rgba(27,24,21,0.08)] animate-fade-up">
            <button
                onClick={handleDismiss}
                className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
                aria-label="Dismiss"
            >
                <X size={20} />
            </button>

            <div className="flex items-start gap-4">
                <div className="bg-gray-100 p-2 rounded-md">
                    <img src="/icons/icon-192x192.png" alt="" className="w-8 h-8 rounded-md" />
                </div>
                <div className="flex-1">
                    <h3 className="font-medium text-gray-900">Add Vital to your home screen</h3>
                    <p className="text-sm text-gray-600 mt-1">
                        So alerts reach you, and the app is one tap away when someone needs blood.
                    </p>

                    {isIOS ? (
                        <div className="mt-3 text-sm bg-gray-50 p-3 rounded-lg border border-gray-100">
                            <p className="flex items-center gap-2 mb-1">
                                1. Tap the <Share size={16} /> Share button
                            </p>
                            <p className="flex items-center gap-2">
                                2. Select <PlusSquare size={16} /> <strong>Add to Home Screen</strong>
                            </p>
                        </div>
                    ) : (
                        <div className="mt-4 flex gap-3">
                            <Button
                                size="sm"
                                variant="ink"
                                className="w-full"
                                onClick={handleInstallClick}
                            >
                                Install
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
