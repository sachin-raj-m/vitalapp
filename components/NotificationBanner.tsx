"use client";

import { useEffect, useState } from 'react';
import { AlertCircle, Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';

export function NotificationBanner() {
    const [isVisible, setIsVisible] = useState(false);
    const [permission, setPermission] = useState<NotificationPermission>('default');

    useEffect(() => {
        // Check permission strictly on client
        if (typeof window !== 'undefined' && 'Notification' in window) {
            setPermission(Notification.permission);

            // Show if permission is default (not asked) or denied (educate)
            // But respect user dismissal for this session/device
            const isDismissed = localStorage.getItem('notification_banner_dismissed') === 'true';

            if (Notification.permission === 'default' && !isDismissed) {
                setIsVisible(true);
            }
        }
    }, []);

    const handleEnable = async () => {
        if (!('Notification' in window)) {
            toast.error("Your device doesn't support notifications");
            return;
        }

        try {
            const result = await Notification.requestPermission();
            setPermission(result);
            if (result === 'granted') {
                toast.success('Awesome! You will now be notified of urgent blood requests.');
                setIsVisible(false);
                // Optionally verify/register service worker logic here too if needed, 
                // but main SubscriptionManager handles the actual push subscription. 
                // This is just to get the OS permission first.
            } else if (result === 'denied') {
                toast.error('Notifications blocked. Please enable them in site settings.');
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleDismiss = () => {
        setIsVisible(false);
        localStorage.setItem('notification_banner_dismissed', 'true');
    };

    if (!isVisible) return null;

    return (
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r shadow-sm mb-6 relative animate-in slide-in-from-top-2">
            <div className="flex items-start gap-4">
                <div className="bg-blue-100 p-2 rounded-full shrink-0">
                    <Bell className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-grow">
                    <h3 className="font-bold text-blue-900 border-none m-0 p-0 text-base">Enable Notifications to Save Lives!</h3>
                    <p className="text-blue-700 text-sm mt-1">
                        Don't miss urgent blood requests near you. Every second counts.
                    </p>
                    <div className="mt-3 flex gap-2">
                        <Button size="sm" onClick={handleEnable}>
                            Click to Enable
                        </Button>
                        <Button size="sm" variant="ghost" className="text-blue-600 hover:bg-blue-100" onClick={handleDismiss}>
                            Later
                        </Button>
                    </div>
                </div>
                <button
                    onClick={handleDismiss}
                    className="absolute top-2 right-2 text-blue-400 hover:text-blue-600 transition-colors"
                >
                    <X size={16} />
                </button>
            </div>
        </div>
    );
}
