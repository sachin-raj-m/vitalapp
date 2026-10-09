"use client";

import React, { useEffect, useState } from 'react';
import { Copy, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { supabase } from '@/lib/supabase';
import { whatsappShareUrl } from '@/lib/share';
import { REFERRAL_POINTS, buildReferralMessage, referralPath } from '@/lib/referrals';
import { formatBloodGroup } from '@/lib/blood-compatibility';

/** Profile card: the donor's referral link, how many they've brought in, and share buttons. */
export function InviteDonors({ bloodGroup }: { bloodGroup?: string | null }) {
    const [code, setCode] = useState<string | null | undefined>(undefined);
    const [count, setCount] = useState<number | null>(null);

    useEffect(() => {
        let cancelled = false;
        Promise.all([supabase.rpc('get_my_referral_code'), supabase.rpc('get_my_referral_count')]).then(([c, n]) => {
            if (cancelled) return;
            // A code is a non-empty string; anything else means there's nothing to share.
            setCode(!c.error && typeof c.data === 'string' && c.data ? c.data : null);
            setCount(n.error ? null : Number(n.data ?? 0));
        });
        return () => { cancelled = true; };
    }, []);

    // Not a donor (no code): nothing to invite with.
    if (code === null) return null;

    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://vitalapp.in';
    const link = code ? `${origin}${referralPath(code)}` : '';
    const message = code ? buildReferralMessage(origin, code, bloodGroup ? formatBloodGroup(bloodGroup) : null) : '';

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(link);
            toast.success('Invite link copied');
        } catch {
            toast.error('Couldn’t copy. Select the link and copy it instead.');
        }
    };

    return (
        <div className="border-t border-gray-200 pt-8">
            <h2 className="text-lg font-medium tracking-tight text-gray-900">Invite donors</h2>
            <p className="mt-1 max-w-md text-sm leading-relaxed text-gray-600">
                Every donor you bring in means more people can be reached when blood is needed.
                You get {REFERRAL_POINTS} points on your Milestones for each friend who registers as a donor with your link.
                Points are for recognition only.
            </p>
            {code === undefined ? (
                <Skeleton className="mt-4 h-9 w-full max-w-md" />
            ) : (
                <>
                    <div className="mt-4 flex items-center gap-2">
                        <code className="min-w-0 flex-1 truncate rounded-md border border-gray-200 bg-white px-3 py-2 font-mono text-[13px] text-gray-700">
                            {link.replace(/^https?:\/\//, '')}
                        </code>
                        <Button size="sm" variant="secondary" onClick={copy} aria-label="Copy invite link"><Copy className="h-3.5 w-3.5" /></Button>
                        <a
                            href={whatsappShareUrl(message)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#15803D] px-3 text-sm font-medium text-white hover:bg-[#166534]"
                        >
                            <Send className="h-3.5 w-3.5" /> WhatsApp
                        </a>
                    </div>
                    {count !== null && (
                        <p className="mt-2 text-sm text-gray-500">
                            {count === 0 ? 'No one has joined with your link yet.' : `${count} ${count === 1 ? 'donor has' : 'donors have'} joined with your link.`}
                        </p>
                    )}
                </>
            )}
        </div>
    );
}
