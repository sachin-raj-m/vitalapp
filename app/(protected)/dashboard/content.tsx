"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ArrowRight, Inbox } from 'lucide-react';
import { motion } from 'framer-motion';
import { CountUp } from '@/components/landing/CountUp';
import { BloodRequestCard } from '@/components/BloodRequestCard';
import { useAuth } from '@/context/AuthContext';
import { formatBloodGroup, isBloodCompatible } from '@/lib/blood-compatibility';
import { DashboardSkeleton } from '@/components/skeletons/DashboardSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { useRequests } from '@/context/RequestsContext';
import { NotificationBanner } from '@/components/NotificationBanner';
import { fetchUserStats, calculateEligibility, describePoints, type UserStats } from '@/lib/stats';

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
                <p className="text-sm font-medium text-red-700">{format(new Date(), 'EEEE, d MMMM')}</p>
                <h1 className="display mt-2 text-4xl sm:text-[2.75rem]">
                    {greeting()}, {firstName}
                </h1>
            </header>

            <dl className="grid gap-3 sm:grid-cols-3 sm:gap-4">
                <div
                    className={`rounded-xl border p-5 ${eligibility.isEligible
                        ? 'border-success-200 bg-success-50'
                        : 'border-warning-200 bg-warning-50'}`}
                >
                    <dt className="text-sm font-medium text-gray-600">Donor status</dt>
                    <dd className="mt-2">
                        <div className="flex items-center gap-2">
                            <span className="relative flex h-2.5 w-2.5" aria-hidden>
                                {eligibility.isEligible && <span className="absolute inline-flex h-full w-full rounded-full bg-success-500 animate-beat" />}
                                <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${eligibility.isEligible ? 'bg-success-500' : 'bg-warning-500'}`} />
                            </span>
                            <span className={`text-lg font-semibold ${eligibility.isEligible ? 'text-success-800' : 'text-warning-800'}`}>
                                {eligibility.isEligible ? 'Eligible to donate' : 'Not yet eligible'}
                            </span>
                        </div>
                        <p className="mt-1 text-sm text-gray-700">
                            {eligibility.isEligible
                                ? `Blood group ${formatBloodGroup(user?.blood_group)}`
                                : `Eligible again on ${format(eligibility.nextEligibleDate, 'd MMM')}`}
                        </p>
                    </dd>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-5">
                    <dt className="text-sm font-medium text-gray-600">Donations</dt>
                    <dd className="mt-1">
                        <CountUp value={stats?.total_donations ?? 0} className="font-serif text-5xl font-semibold leading-none text-red-600" />
                        <p className="mt-1.5 text-sm text-gray-600">
                            {stats ? describePoints(stats.points) : '0 points'}
                        </p>
                    </dd>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-5">
                    <dt className="text-sm font-medium text-gray-600">Next milestone</dt>
                    <dd className="mt-2">
                        {nextBadge ? (
                            <Link href="/milestones" className="group block">
                                <div className="flex items-baseline justify-between gap-2">
                                    <span className="text-lg font-semibold text-gray-900 group-hover:text-red-700">
                                        {nextBadge.name} <span className="text-sm font-normal text-gray-600">+{nextBadge.points} bonus</span>
                                    </span>
                                    <span className="text-sm tabular-nums text-gray-600">{nextBadge.progress} of {nextBadge.threshold}</span>
                                </div>
                                <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-red-50">
                                    <motion.div
                                        className="h-full rounded-full bg-red-600"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${Math.min(100, ((nextBadge.progress ?? 0) / (nextBadge.threshold ?? 1)) * 100)}%` }}
                                        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
                                    />
                                </div>
                                <p className="mt-1.5 text-sm text-gray-600">
                                    {(nextBadge.threshold ?? 0) - (nextBadge.progress ?? 0)} more donations to reach it
                                </p>
                            </Link>
                        ) : (
                            <Link href="/milestones" className="text-lg font-semibold text-gray-900 hover:text-red-700">
                                All milestones reached
                            </Link>
                        )}
                    </dd>
                </div>
            </dl>

            <section className="space-y-4">
                <div className="flex items-end justify-between gap-4">
                    <div>
                        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-gray-900">
                            Requests you can answer
                            {matches.length > 0 && (
                                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-2 text-xs font-semibold text-white">
                                    {matches.length}
                                </span>
                            )}
                        </h2>
                        <p className="text-sm text-gray-500">
                            Open requests that match your blood group ({formatBloodGroup(user?.blood_group)}).
                        </p>
                    </div>
                    <Link href="/requests" className="hidden shrink-0 items-center gap-1 text-sm font-semibold text-red-700 underline-offset-4 hover:underline sm:inline-flex">
                        View all requests <ArrowRight className="h-3.5 w-3.5" />
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
                        title="No matching requests"
                        description="There are no open requests compatible with your blood group at the moment. We’ll notify you when one is posted."
                        actionLabel="Browse all requests"
                        onAction={() => router.push('/requests')}
                    />
                )}
            </section>
        </div>
    );
}
