"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { authedFetch } from '@/lib/api';
import { WHATSAPP_VERIFY_NUMBER } from '@/lib/features';

const POLL_MS = 4000;

type Started = { code: string; link: string; number: string; to: string; minutes: number; until: number };

/**
 * "Verify on WhatsApp" for the saved mobile number. Vital can't message first
 * (no approved template yet), so the person sends "VERIFY <code>" to Vital's
 * number from their own WhatsApp; this polls until the bot has confirmed it.
 * Renders nothing when the option isn't configured (NEXT_PUBLIC_WHATSAPP_NUMBER).
 */
export function WhatsAppVerify({
    onVerified,
    size = 'md',
    intro,
}: {
    onVerified: () => void | Promise<void>;
    size?: 'sm' | 'md';
    /** Shown above the button before the flow starts. */
    intro?: React.ReactNode;
}) {
    const [started, setStarted] = useState<Started | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [hidden, setHidden] = useState(false);
    const done = useRef(false);

    const check = useCallback(async (manual = false) => {
        if (done.current) return;
        const res = await authedFetch('/api/profile/phone/whatsapp').catch(() => null);
        const body = res?.ok ? await res.json().catch(() => null) : null;
        if (body?.verified) {
            done.current = true;
            setStarted(null);
            await onVerified();
        } else if (manual) {
            setNotice('We haven’t received it yet. Make sure you sent the message as it is, from the number on your profile. It can take a few seconds.');
        }
    }, [onVerified]);

    // Poll while a code is out, and check straight away when the person comes
    // back to this tab from WhatsApp.
    useEffect(() => {
        if (!started) return;
        const timer = setInterval(() => {
            if (Date.now() > started.until) {
                setStarted(null);
                setNotice('That code has expired. Start again to get a new one.');
                return;
            }
            if (document.visibilityState === 'visible') check();
        }, POLL_MS);
        const onVisible = () => { if (document.visibilityState === 'visible') check(); };
        document.addEventListener('visibilitychange', onVisible);
        return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
    }, [started, check]);

    if (!WHATSAPP_VERIFY_NUMBER || hidden) return null;

    const start = async () => {
        setError(''); setNotice(''); setBusy(true);
        try {
            const res = await authedFetch('/api/profile/phone/whatsapp', { method: 'POST', body: JSON.stringify({ action: 'start' }) });
            const body = await res.json().catch(() => null);
            if (body?.unavailable) { setHidden(true); return; }
            if (!res.ok) throw new Error(body?.error || 'Could not start verification. Please try again.');
            if (body.verified) { done.current = true; await onVerified(); return; }
            setStarted({ ...body, until: Date.now() + body.minutes * 60_000 });
        } catch (err: any) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="space-y-3 text-sm">
            {!started ? (
                <>
                    {intro}
                    <Button type="button" variant="secondary" size={size} onClick={start} isLoading={busy} leftIcon={<MessageCircle className="h-4 w-4" />}>
                        Verify on WhatsApp
                    </Button>
                </>
            ) : (
                <div className="space-y-3 rounded-md border border-gray-200 bg-white p-4">
                    <p className="leading-relaxed text-gray-700">
                        Send <span className="font-mono text-gray-900">VERIFY {started.code}</span> to Vital on WhatsApp from{' '}
                        <span className="text-gray-900">{started.to}</span>. The button opens WhatsApp with the message ready; just tap send.
                        The code works for {started.minutes} minutes.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                        <a
                            href={started.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-10 items-center gap-2 rounded-md bg-gray-900 px-4 text-sm text-white hover:bg-gray-800"
                        >
                            <MessageCircle className="h-4 w-4" /> Open WhatsApp
                        </a>
                        <Button type="button" variant="ghost" onClick={() => check(true)}>I’ve sent it</Button>
                    </div>
                    <p className="text-[13px] text-gray-500">
                        On a computer? Send the message to {started.number} from your phone. This page updates once it arrives.
                    </p>
                </div>
            )}
            {notice && <p className="text-[13px] text-gray-600">{notice}</p>}
            {error && <p className="text-[13px] text-red-700">{error}</p>}
        </div>
    );
}
