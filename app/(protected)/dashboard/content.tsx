"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ArrowRight, Inbox } from 'lucide-react';
import { BloodRequestCard } from '@/components/BloodRequestCard';
import { useAuth } from '@/context/AuthContext';
import { formatBloodGroup, isBloodCompatible } from '@/lib/blood-compatibility';
import { DashboardSkeleton } from '@/components/skeletons/DashboardSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { useRequests } from '@/context/RequestsContext';
import { NotificationBanner } from '@/components/NotificationBanner';
import { fetchUserStats, calculateEligibility, type UserStats } from '@/lib/stats';

const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

export default function DashboardPage() {
    const { user } = useAuth();
    const router = useRouter();
    const { requests, myDonations, loading: requestsLoading } = useRequests();

    const [stats, setStats] = useState<UserStats | null>(null);
    const [isLoadingStats, setIsLoadingStats] = useState(true);

    useEffect(() => {
        if (!user) return;
        fetchUserStats(user.id)
            .then(setStats)
            .catch(error => console.error('Error fetching stats', error))
            .finally(() => setIsLoadingStats(false));
    }, [user]);

    const matches = useMemo(
        () => requests.filter(req =>
            req.user_id !== user?.id &&
            !!user?.blood_group &&
            !!req.blood_group &&
            isBloodCompatible(user.blood_group, req.blood_group)
        ),
        [requests, user],
    );

    if (requestsLoading || isLoadingStats) return <DashboardSkeleton />;

    const eligibility = calculateEligibility(stats?.last_donation_date || null);
    const nextBadge = stats?.achievements?.find(a => !a.unlocked && a.type === 'count');
    const firstName = user?.full_name?.split(' ')[0] || 'there';

    return (
        <div className="space-y-10">
            <NotificationBanner />

            <header>
                <p className="eyebrow">{format(new Date(), 'EEEE, d MMMM')}</p>
                <h1 className="display mt-3 text-5xl leading-none">
                    {greeting()}, <em>{firstName}.</em>
                </h1>
            </header>

            <dl className="grid overflow-hidden rounded-lg border border-gray-200 bg-white sm:grid-cols-3 sm:divide-x sm:divide-gray-200">
                <div className="p-5 sm:p-6">
                    <dt className="eyebrow">Status</dt>
                    <dd className="mt-4">
                        <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${eligibility.isEligible ? 'bg-success-500' : 'bg-warning-500'}`} />
                            <span className="text-xl font-medium tracking-tight text-gray-900">
                                {eligibility.isEligible ? 'Ready to donate' : 'Recovering'}
                            </span>
                        </div>
                        <p className="mt-1.5 text-sm text-gray-500">
                            {eligibility.isEligible
                                ? `Blood group ${formatBloodGroup(user?.blood_group)}`
                                : `Eligible again on ${format(eligibility.nextEligibleDate, 'd MMM')}`}
                        </p>
                    </dd>
                </div>

                <div className="border-t border-gray-200 p-5 sm:border-t-0 sm:p-6">
                    <dt className="eyebrow">Donations</dt>
                    <dd className="mt-3 flex items-baseline gap-3">
                        <span className="font-serif text-5xl leading-none tracking-tight text-gray-900">{stats?.total_donations ?? 0}</span>
                        <span className="text-sm text-gray-500">{stats?.total_points ?? 0} pts</span>
                    </dd>
                </div>

                <div className="border-t border-gray-200 p-5 sm:border-t-0 sm:p-6">
                    <dt className="eyebrow">Next milestone</dt>
                    <dd className="mt-4">
                        {nextBadge ? (
                            <Link href="/achievements" className="group block">
                                <div className="flex items-baseline justify-between gap-2">
                                    <span className="font-medium text-gray-900 group-hover:underline group-hover:underline-offset-4">{nextBadge.name}</span>
                                    <span className="font-mono text-xs text-gray-500">{nextBadge.progress}/{nextBadge.threshold}</span>
                                </div>
                                <div className="mt-3 h-1 overflow-hidden rounded-full bg-gray-200">
                                    <div
                                        className="h-full rounded-full bg-red-600 transition-[width] duration-700"
                                        style={{ width: `${Math.min(100, ((nextBadge.progress ?? 0) / (nextBadge.threshold ?? 1)) * 100)}%` }}
                                    />
                                </div>
                                <p className="mt-2 text-[13px] text-gray-500">
                                    {(nextBadge.threshold ?? 0) - (nextBadge.progress ?? 0)} more to go
                                </p>
                            </Link>
                        ) : (
                            <Link href="/achievements" className="font-medium text-gray-900 hover:underline hover:underline-offset-4">
                                Every milestone reached
                            </Link>
                        )}
                    </dd>
                </div>
            </dl>

            <section className="space-y-4">
                <div className="flex items-end justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-medium tracking-tight text-gray-900">Requests you can answer</h2>
                        <p className="text-sm text-gray-500">
                            Open requests your blood ({formatBloodGroup(user?.blood_group)}) is compatible with.
                        </p>
                    </div>
                    <Link href="/requests" className="hidden shrink-0 items-center gap-1 text-sm text-gray-600 hover:text-gray-900 sm:inline-flex">
                        All requests <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                </div>

                {matches.length > 0 ? (
                    <div className="space-y-3">
                        {matches.map(request => (
                            <BloodRequestCard
                                key={request.id}
                                request={request}
                                onRespond={() => router.push(`/requests?offer=${request.id}`)}
                                onPendingClick={() => router.push('/donations')}
                                userBloodGroup={user?.blood_group}
                                hasOffered={myDonations.has(request.id)}
                                isOwnRequest={request.user_id === user?.id}
                            />
                        ))}
                    </div>
                ) : (
                    <EmptyState
                        icon={Inbox}
                        title="Nothing for you right now"
                        description="No open request is compatible with your blood group at the moment. We’ll notify you when one is."
                        actionLabel="Browse all requests"
                        onAction={() => router.push('/requests')}
                    />
                )}
            </section>
        </div>
    );
}
