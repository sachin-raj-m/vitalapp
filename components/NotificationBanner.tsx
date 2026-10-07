"use client";

import { useEffect, useState } from 'react';
import { BellRing, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';

export function NotificationBanner() {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (!('Notification' in window)) return;
        let dismissed = false;
        try { dismissed = localStorage.getItem('notification_banner_dismissed') === 'true'; } catch { /* storage blocked */ }
        if (Notification.permission === 'default' && !dismissed) setIsVisible(true);
    }, []);

    const handleEnable = async () => {
        try {
            const result = await Notification.requestPermission();
            if (result === 'granted') {
                toast.success('You’ll be notified when someone nearby needs your blood group.');
                setIsVisible(false);
            } else if (result === 'denied') {
                toast.error('Notifications are blocked. You can turn them on in your browser’s site settings.');
                setIsVisible(false);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleDismiss = () => {
        setIsVisible(false);
        try { localStorage.setItem('notification_banner_dismissed', 'true'); } catch { /* storage blocked */ }
    };

    if (!isVisible) return null;

    return (
        <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:p-5">
            <BellRing className="hidden h-5 w-5 shrink-0 text-red-600 sm:block" strokeWidth={1.75} />
            <div className="flex-1">
                <p className="font-medium text-gray-900">Turn on notifications</p>
                <p className="mt-0.5 text-sm text-gray-600">
                    Get notified when someone near you needs your blood group.
                </p>
            </div>
            <div className="flex items-center gap-2">
                <Button size="sm" variant="ink" onClick={handleEnable}>Turn on</Button>
                <button onClick={handleDismiss} className="rounded-md p-1.5 text-gray-500 hover:text-gray-900" aria-label="Dismiss">
                    <X className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}
