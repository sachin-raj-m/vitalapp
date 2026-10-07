"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatBloodGroup } from '@/lib/blood-compatibility';
import { cn } from '@/lib/cn';
import type { BloodGroup, UrgencyLevel } from '@/types';

interface LiveRequest {
    id: string;
    blood_group: BloodGroup;
    units_needed: number;
    hospital_name: string;
    city: string | null;
    urgency_level: UrgencyLevel;
    created_at: string;
}

const URGENCY: Record<UrgencyLevel, { label: string; className: string }> = {
    High: { label: 'Urgent', className: 'text-red-700' },
    Medium: { label: 'Needed soon', className: 'text-warning-700' },
    Low: { label: 'Planned', className: 'text-gray-600' },
};

// Below this many requests the strip sits still; above it, it scrolls gently.
const MARQUEE_MIN = 4;

function RequestChip({ request, hidden }: { request: LiveRequest; hidden?: boolean }) {
    const urgent = request.urgency_level === 'High';
    const urgency = URGENCY[request.urgency_level] ?? URGENCY.Low;
    const units = `${request.units_needed} unit${request.units_needed === 1 ? '' : 's'}`;
    return (
        <Link
            href={`/requests/${request.id}`}
            aria-hidden={hidden || undefined}
            tabIndex={hidden ? -1 : undefined}
            className="lift group flex w-[17.5rem] shrink-0 items-center gap-3.5 rounded-xl border border-gray-200 bg-white p-3 pr-4 hover:border-red-200"
        >
            <span
                className={cn(
                    'flex h-14 w-14 shrink-0 items-center justify-center rounded-lg font-serif text-[1.75rem] font-semibold leading-none',
                    urgent ? 'bg-red-600 text-white' : 'bg-red-50 text-red-700',
                )}
            >
                {formatBloodGroup(request.blood_group)}
            </span>
            <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-xs font-semibold">
                    <span className={urgency.className}>{urgency.label}</span>
                    <span className="text-gray-300" aria-hidden>·</span>
                    <span className="font-medium text-gray-500">
                        {formatDistanceToNowStrict(new Date(request.created_at), { addSuffix: true })}
                    </span>
                </span>
                <span className="mt-0.5 block truncate text-[15px] font-semibold text-gray-900 group-hover:text-red-700">
                    {units} at {request.hospital_name}
                </span>
                {request.city && <span className="block truncate text-sm text-gray-500">{request.city}</span>}
            </span>
        </Link>
    );
}

/**
 * The latest open requests, straight from the database. Only non-identifying
 * fields are selected (never phone numbers or notes).
 */
export function LiveRequests() {
    const [requests, setRequests] = useState<LiveRequest[] | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        const today = format(new Date(), 'yyyy-MM-dd');
        supabase
            .from('blood_requests')
            .select('id, blood_group, units_needed, hospital_name, city, urgency_level, created_at')
            .eq('status', 'active')
            .or(`date_needed.is.null,date_needed.gte.${today}`)
            .order('created_at', { ascending: false })
            .limit(8)
            .then(({ data, error }) => {
                if (error) { setFailed(true); return; }
                setRequests((data ?? []) as LiveRequest[]);
            });
    }, []);

    if (failed) return null;

    const loading = requests === null;
    const count = requests?.length ?? 0;
    const scrolling = count >= MARQUEE_MIN;

    // Repeat short lists so one copy is wider than the screen, then double it for a seamless loop.
    const base = scrolling ? Array.from({ length: Math.ceil(8 / count) }, () => requests!).flat() : [];

    return (
        <div>
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
                <p className="flex items-center gap-2.5 text-sm font-semibold text-gray-900">
                    <span className="relative flex h-2.5 w-2.5" aria-hidden>
                        {count > 0 && <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 animate-beat" />}
                        <span className={cn('relative inline-flex h-2.5 w-2.5 rounded-full', count > 0 ? 'bg-red-600' : 'bg-gray-300')} />
                    </span>
                    {count > 0 ? (
                        <>
                            <span className="text-red-700">Live</span>
                            <span className="font-medium text-gray-600">Latest open requests</span>
                        </>
                    ) : (
                        <span className="font-medium text-gray-600">Open requests</span>
                    )}
                </p>
                <Link
                    href="/requests"
                    className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-red-700 underline-offset-4 hover:underline"
                >
                    See all <ArrowRight className="h-3.5 w-3.5" />
                </Link>
            </div>

            <div className="mt-4">
                {loading ? (
                    <div className="mx-auto flex max-w-6xl gap-3 overflow-hidden px-5 sm:px-8" aria-hidden>
                        {[0, 1, 2, 3].map(i => (
                            <div key={i} className="h-[5.125rem] w-[17.5rem] shrink-0 animate-pulse rounded-xl bg-gray-100" />
                        ))}
                    </div>
                ) : count === 0 ? (
                    <p className="mx-auto max-w-6xl px-5 text-[15px] text-gray-600 sm:px-8">
                        No open requests right now. New requests appear here as soon as they are posted.
                    </p>
                ) : scrolling ? (
                    <div className="fade-x no-scrollbar overflow-hidden motion-reduce:overflow-x-auto">
                        <ul
                            className="flex w-max gap-3 py-2 animate-marquee hover:[animation-play-state:paused] focus-within:[animation-play-state:paused] motion-reduce:animate-none motion-reduce:px-5"
                            style={{ ['--marquee-duration' as string]: `${base.length * 5}s` }}
                            aria-label="Latest open requests"
                        >
                            {base.map((r, i) => (
                                <li key={`a-${i}`} className={cn('flex', i >= count && 'motion-reduce:hidden')} aria-hidden={i >= count || undefined}>
                                    <RequestChip request={r} hidden={i >= count} />
                                </li>
                            ))}
                            {base.map((r, i) => (
                                <li key={`b-${i}`} className="flex motion-reduce:hidden" aria-hidden>
                                    <RequestChip request={r} hidden />
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : (
                    <ul className="no-scrollbar mx-auto flex max-w-6xl gap-3 overflow-x-auto px-5 py-2 sm:px-8" aria-label="Latest open requests">
                        {requests!.map(r => (
                            <li key={r.id} className="flex">
                                <RequestChip request={r} />
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
