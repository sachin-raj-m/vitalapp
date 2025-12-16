"use client";

import React, { useEffect, useState } from 'react';
import { X, Share, PlusSquare } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export function PWAInstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [showPrompt, setShowPrompt] = useState(false);
    const [isIOS, setIsIOS] = useState(false);

    useEffect(() => {
        // Check if already installed
        if (window.matchMedia('(display-mode: standalone)').matches) {
            return;
        }

        // Check for iOS
        const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
        setIsIOS(isIosDevice);

        if (isIosDevice) {
            // Show prompt for iOS after a small delay if not dismissed before
            const hasDismissed = localStorage.getItem('pwa_prompt_dismissed');
            if (!hasDismissed) {
                setTimeout(() => setShowPrompt(true), 3000);
            }
        }

        const handleBeforeInstallPrompt = (e: Event) => {
            // Prevent Chrome 67 and earlier from automatically showing the prompt
            e.preventDefault();
            // Stash the event so it can be triggered later.
            setDeferredPrompt(e);

            // Check if dismissed previously
            const hasDismissed = localStorage.getItem('pwa_prompt_dismissed');
            if (!hasDismissed) {
                setShowPrompt(true);
            }
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstallClick = async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                setDeferredPrompt(null);
            }
            setShowPrompt(false);
        }
    };

    const handleDismiss = () => {
        setShowPrompt(false);
        localStorage.setItem('pwa_prompt_dismissed', 'true');
    };

    if (!showPrompt) return null;

    return (
        <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96 bg-white rounded-xl shadow-2xl border border-gray-100 p-4 animate-in slide-in-from-bottom-5">
            <button
                onClick={handleDismiss}
                className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
            >
                <X size={20} />
            </button>

            <div className="flex items-start gap-4">
                <div className="bg-primary-100 p-3 rounded-lg">
                    <img src="/icons/icon-192x192.png" alt="App Icon" className="w-8 h-8 rounded-md" />
                </div>
                <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">Install VitalApp</h3>
                    <p className="text-sm text-gray-600 mt-1">
                        Get the best experience with full-screen access and offline support.
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
                                className="w-full"
                                onClick={handleInstallClick}
                            >
                                Install App
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
