"use client";

import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Check } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { fetchUserStats, type UserStats } from '@/lib/stats';
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
                <p className="eyebrow">Milestones</p>
                <h1 className="display mt-3 text-5xl leading-none">
                    {stats ? <>{earned} of {achievements.length} <em>reached.</em></> : 'Milestones'}
                </h1>
                <p className="mt-3 max-w-lg text-gray-600">
                    Small markers along the way. Points are just for you. They don’t buy anything, and nobody else sees them.
                </p>
            </header>

            {error && <Alert variant="error">{error}</Alert>}

            <dl className="grid grid-cols-2 overflow-hidden rounded-lg border border-gray-200 bg-white sm:grid-cols-3 sm:divide-x sm:divide-gray-200">
                {[
                    ['Donations', stats?.total_donations],
                    ['Points', stats?.total_points],
                    ['Requests posted', stats?.total_requests],
                ].map(([label, value], i) => (
                    <div key={label as string} className={cn('p-5 sm:p-6', i === 2 && 'col-span-2 border-t border-gray-200 sm:col-span-1 sm:border-t-0', i === 1 && 'border-l border-gray-200 sm:border-l-0')}>
                        <dt className="eyebrow">{label}</dt>
                        <dd className="mt-3 font-serif text-4xl leading-none tracking-tight text-gray-900">
                            {stats ? value ?? 0 : <Skeleton className="h-9 w-14" />}
                        </dd>
                    </div>
                ))}
            </dl>

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
                                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-mono text-xs',
                                        a.unlocked ? 'bg-gray-900 text-gray-50' : 'border border-dashed border-gray-300 text-gray-400',
                                    )}
                                >
                                    {a.unlocked ? <Check className="h-4 w-4" /> : a.threshold ?? '★'}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                                        <h2 className={cn('font-medium', a.unlocked ? 'text-gray-900' : 'text-gray-700')}>{a.name}</h2>
                                        <span className="font-mono text-xs text-gray-500">+{a.points} pts</span>
                                    </div>
                                    <p className="mt-0.5 text-sm text-gray-500">
                                        {a.description}
                                        {a.unlocked && a.unlockedDate && ` · ${format(new Date(a.unlockedDate), 'd MMM yyyy')}`}
                                    </p>
                                    {a.unlocked ? (
                                        <p className="mt-2 font-serif text-lg italic text-gray-700">“{a.motto}”</p>
                                    ) : a.threshold ? (
                                        <div className="mt-3 flex items-center gap-3">
                                            <div className="h-1 max-w-xs flex-1 overflow-hidden rounded-full bg-gray-200">
                                                <div className="h-full rounded-full bg-red-600" style={{ width: `${pct}%` }} />
                                            </div>
                                            <span className="font-mono text-xs text-gray-500">{a.progress}/{a.threshold}</span>
                                        </div>
                                    ) : null}
                                </div>
                            </li>
                        );
                    })}
            </ol>
        </div>
    );
}
