"use client";

import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Check } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { fetchUserStats, describePoints, type UserStats } from '@/lib/stats';
import { POINTS_PER_DONATION } from '@/lib/constants';
import { REFERRAL_POINTS } from '@/lib/referrals';
import { ReferralLeaderboard } from '@/components/ReferralLeaderboard';
import { Skeleton } from '@/components/ui/Skeleton';
import { Alert } from '@/components/ui/Alert';
import { cn } from '@/lib/cn';

export default function AchievementsPage() {
    const { user } = useAuth();
    const [stats, setStats] = useState<UserStats | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!user?.id) return;
        fetchUserStats(user.id)
            .then(setStats)
            .catch(() => setError('Couldn’t load your milestones. Please refresh.'));
    }, [user?.id]);

    const achievements = stats?.achievements ?? [];
    const earned = achievements.filter(a => a.unlocked).length;

    return (
        <div className="space-y-10">
            <header>
                <h1 className="display text-4xl sm:text-[2.75rem]">Milestones</h1>
                <p className="mt-3 max-w-lg text-gray-600">
                    {stats && `You have reached ${earned} of ${achievements.length} milestones. `}
                    You earn {POINTS_PER_DONATION} points for each completed donation, a one-time bonus for each milestone you reach,
                    and {REFERRAL_POINTS} points for each donor who joins with your invite link (on your Profile).
                    Points are recognition only: they are visible only to you and can’t be exchanged for anything.
                </p>
            </header>

            {error && <Alert variant="error">{error}</Alert>}

            <dl className="grid grid-cols-2 gap-6 border-y border-gray-200 py-6 sm:grid-cols-4 sm:gap-8">
                {[
                    ['Donations', stats?.total_donations],
                    ['Points', stats?.total_points],
                    ['Donors invited', stats?.total_referrals],
                    ['Requests posted', stats?.total_requests],
                ].map(([label, value]) => (
                    <div key={label as string}>
                        <dt className="text-sm text-gray-500">{label}</dt>
                        <dd className="mt-1.5 text-2xl font-medium tabular-nums text-gray-900">
                            {stats ? value ?? 0 : <Skeleton className="h-8 w-12" />}
                        </dd>
                    </div>
                ))}
            </dl>
            {stats && (
                <p className="-mt-6 text-sm tabular-nums text-gray-500">Points: {describePoints(stats.points)}</p>
            )}

            <ol className="divide-y divide-gray-200 overflow-hidden rounded-lg border border-gray-200 bg-white">
                {!stats
                    ? [1, 2, 3, 4].map(i => (
                        <li key={i} className="flex items-center gap-4 p-5">
                            <Skeleton className="h-10 w-10 rounded-full" />
                            <div className="flex-1 space-y-2"><Skeleton className="h-4 w-40" /><Skeleton className="h-3 w-64" /></div>
                        </li>
                    ))
                    : achievements.map(a => {
                        const pct = a.threshold ? Math.min(100, (a.progress / a.threshold) * 100) : 0;
                        return (
                            <li key={a.id} className="flex items-start gap-4 p-5">
                                <div
                                    className={cn(
                                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-medium',
                                        a.unlocked ? 'bg-gray-900 text-gray-50' : 'border border-dashed border-gray-300 text-gray-400',
                                    )}
                                >
                                    {a.unlocked ? <Check className="h-4 w-4" /> : a.threshold ?? '★'}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                                        <h2 className={cn('font-medium', a.unlocked ? 'text-gray-900' : 'text-gray-700')}>{a.name}</h2>
                                        <span className={cn('text-sm', a.unlocked ? 'text-gray-700' : 'text-gray-500')}>
                                            {a.unlocked ? `+${a.points} bonus earned` : `+${a.points} bonus`}
                                        </span>
                                    </div>
                                    <p className="mt-0.5 text-sm text-gray-500">
                                        {a.description}
                                        {a.unlocked && a.unlockedDate && `. Reached ${format(new Date(a.unlockedDate), 'd MMM yyyy')}`}
                                    </p>
                                    {a.unlocked ? (
                                        <p className="mt-2 text-sm text-gray-700">“{a.motto}”</p>
                                    ) : a.threshold ? (
                                        <div className="mt-3 flex items-center gap-3">
                                            <div className="h-1 max-w-xs flex-1 overflow-hidden rounded-full bg-gray-200">
                                                <div className="h-full rounded-full bg-red-600" style={{ width: `${pct}%` }} />
                                            </div>
                                            <span className="text-sm tabular-nums text-gray-500">{a.progress} of {a.threshold}</span>
                                        </div>
                                    ) : null}
                                </div>
                            </li>
                        );
                    })}
            </ol>

            <ReferralLeaderboard />
        </div>
    );
}
