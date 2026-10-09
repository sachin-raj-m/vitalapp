"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/cn';

type Row = { display_name: string; referrals: number; is_me: boolean };

/** Top inviters. Only donors with a public card are listed, by short name. */
export function ReferralLeaderboard() {
    const [rows, setRows] = useState<Row[] | null>(null);

    useEffect(() => {
        let cancelled = false;
        supabase.rpc('referral_leaderboard', { p_limit: 10 }).then(({ data, error }) => {
            if (!cancelled) setRows(error ? [] : ((data ?? []) as Row[]));
        });
        return () => { cancelled = true; };
    }, []);

    if (!rows || rows.length === 0) return null;

    return (
        <section aria-labelledby="leaderboard-heading">
            <h2 id="leaderboard-heading" className="text-lg font-medium tracking-tight text-gray-900">Top inviters</h2>
            <p className="mt-1 text-sm text-gray-600">
                Donors who brought the most new donors to Vital. Only donors with a public card are shown.
                Invite people from your <Link href="/profile" className="underline underline-offset-4">Profile</Link>.
            </p>
            <ol className="mt-4 divide-y divide-gray-200 overflow-hidden rounded-lg border border-gray-200 bg-white">
                {rows.map((r, i) => (
                    <li key={`${r.display_name}-${i}`} className={cn('flex items-center gap-4 px-5 py-3', r.is_me && 'bg-gray-50')}>
                        <span className="w-6 text-sm tabular-nums text-gray-500">{i + 1}</span>
                        <span className="flex-1 font-medium text-gray-900">{r.display_name}{r.is_me && <span className="font-normal text-gray-500"> (you)</span>}</span>
                        <span className="text-sm tabular-nums text-gray-700">{r.referrals} {r.referrals === 1 ? 'donor' : 'donors'}</span>
                    </li>
                ))}
            </ol>
        </section>
    );
}
