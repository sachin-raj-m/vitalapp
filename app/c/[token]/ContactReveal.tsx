"use client";

import React, { useState } from 'react';
import { Phone } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { REVEAL_MINUTES } from '@/lib/contact-link-constants';

type Details = { name: string; phone: string | null; pin: string | null };

export function ContactReveal({ token, viewer, address }: { token: string; viewer: 'donor' | 'requester'; address: string | null }) {
    const [details, setDetails] = useState<Details | null>(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const reveal = async () => {
        setBusy(true);
        setError('');
        try {
            const res = await fetch('/api/contact-link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token }),
            });
            const body = await res.json().catch(() => null);
            if (!res.ok) {
                setError(body?.error === 'closed'
                    ? 'This offer is no longer open.'
                    : res.status === 429
                        ? 'Too many tries. Please wait a few minutes.'
                        : 'This link has expired. Reply LINK to Vital on WhatsApp for a new one.');
                return;
            }
            setDetails(body);
        } catch {
            setError('Couldn’t load the details. Check your connection and try again.');
        } finally {
            setBusy(false);
        }
    };

    if (!details) {
        return (
            <div className="mt-8">
                {error && <Alert variant="error" className="mb-4">{error}</Alert>}
                <Button size="lg" variant="primary" onClick={reveal} isLoading={busy} className="w-full sm:w-auto">
                    Show contact details
                </Button>
                <p className="mt-3 text-sm text-gray-500">
                    For your privacy, details stay visible for {REVEAL_MINUTES} minutes after you open them.
                </p>
            </div>
        );
    }

    const tel = details.phone?.replace(/[^\d+]/g, '');
    return (
        <div className="mt-8 space-y-6" aria-live="polite">
            <div className="rounded-lg border border-gray-200 bg-white p-5">
                <p className="text-sm text-gray-500">{viewer === 'donor' ? 'Contact person' : 'Donor'}</p>
                <p className="mt-1 text-xl font-medium text-gray-900">{details.name}</p>
                {details.phone ? (
                    <a href={`tel:${tel}`} className="mt-4 inline-flex h-11 items-center gap-2 rounded-md bg-gray-900 px-5 text-sm font-medium text-white hover:bg-gray-800">
                        <Phone className="h-4 w-4" /> Call {details.phone}
                    </a>
                ) : (
                    <p className="mt-3 text-gray-600">No phone number was given.</p>
                )}
                {viewer === 'donor' && address && <p className="mt-4 text-sm text-gray-600">Hospital address: {address}</p>}
            </div>

            {viewer === 'donor' && details.pin && (
                <div className="rounded-lg bg-gray-950 px-5 py-6 text-center">
                    <p className="text-sm text-gray-400">Your donor PIN</p>
                    <p className="mt-2 font-mono text-4xl tracking-[0.3em] text-white">{details.pin}</p>
                    <p className="mt-3 text-sm text-gray-400">Give this to them only after you’ve donated, so they can confirm it.</p>
                </div>
            )}
            {viewer === 'requester' && (
                <p className="text-gray-600">
                    After they donate, ask for their 4-digit PIN. We’ll message you on WhatsApp to confirm it, or you can enter it in My requests on Vital.
                </p>
            )}
        </div>
    );
}
