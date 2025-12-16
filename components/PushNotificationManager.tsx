"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export function PushNotificationManager() {
    const [isSupported, setIsSupported] = useState(false);
    const [subscription, setSubscription] = useState<PushSubscription | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            setIsSupported(true);
            registerServiceWorker();
        } else {
            setLoading(false);
        }
    }, []);

    const registerServiceWorker = async () => {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            const sub = await registration.pushManager.getSubscription();
            setSubscription(sub);
        } catch (error) {
            console.error('Service Worker registration failed:', error);
        } finally {
            setLoading(false);
        }
    };

    const subscribeToPush = async () => {
        if (!PUBLIC_KEY) {
            console.error('VAPID Public Key not found. Please check .env file.');
            toast.error('Configuration error: Public Key missing');
            return;
        }

        setLoading(true);
        try {
            const registration = await navigator.serviceWorker.ready;

            const sub = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY)
            });

            // Send subscription to backend
            await saveSubscription(sub);
            setSubscription(sub);
            toast.success('Notifications enabled!');
        } catch (error) {
            console.error('Failed to subscribe:', error);
            toast.error('Failed to enable notifications');
        } finally {
            setLoading(false);
        }
    };

    const unsubscribeFromPush = async () => {
        setLoading(true);
        try {
            if (subscription) {
                await subscription.unsubscribe();
                setSubscription(null);
                toast.success('Notifications disabled');
            }
        } catch (error) {
            console.error('Failed to unsubscribe:', error);
        } finally {
            setLoading(false);
        }
    };

    const saveSubscription = async (sub: PushSubscription) => {
        const response = await fetch('/api/web-push/subscription', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(sub),
        });

        if (!response.ok) {
            throw new Error('Failed to save subscription');
        }
    };

    if (loading) {
        return <Loader2 className="h-5 w-5 animate-spin text-gray-500" />;
    }

    if (!isSupported) {
        return <div className="text-sm text-gray-500">Push notifications not supported</div>;
    }

    return (
        <div className="flex items-center space-x-2">
            {subscription ? (
                <Button
                    variant="outline"
                    size="sm"
                    onClick={unsubscribeFromPush}
                    className="text-red-600 border-red-200 hover:bg-red-50"
                >
                    <BellOff className="h-4 w-4 mr-2" />
                    Disable Notifications
                </Button>
            ) : (
                <Button
                    variant="outline"
                    size="sm"
                    onClick={subscribeToPush}
                    className="text-primary-600 border-primary-200 hover:bg-primary-50"
                >
                    <Bell className="h-4 w-4 mr-2" />
                    Enable Notifications
                </Button>
            )}
        </div>
    );
}
