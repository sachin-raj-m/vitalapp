"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Activity, Users, TrendingUp, Calendar, Heart, Shield, Award, CheckCircle, Trophy, Target, Star, Lock } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { BloodRequestCard } from '@/components/BloodRequestCard';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import type { BloodRequest } from '@/types';
import { isBloodCompatible } from '@/lib/blood-compatibility';
import { addDays, differenceInDays } from 'date-fns';
import { DashboardSkeleton } from '@/components/skeletons/DashboardSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { useRequests } from '@/context/RequestsContext';
import { NotificationBanner } from '@/components/NotificationBanner';
import { fetchUserStats, calculateEligibility, type UserStats } from '@/lib/stats';

export default function DashboardPage() {
    const { user } = useAuth();
    const router = useRouter();
    const { requests, myDonations, loading: requestsLoading } = useRequests();

    const [stats, setStats] = useState<UserStats | null>(null);
    const [smartMatches, setSmartMatches] = useState<BloodRequest[]>([]);
    const [isLoadingStats, setIsLoadingStats] = useState(true);

    useEffect(() => {
        if (user) {
            loadStats();
        }
    }, [user]);

    // Recalculate smart matches
    useEffect(() => {
        if (requests.length > 0 && user?.blood_group) {
            const matches = requests.filter(req => {
                if (req.user_id === user.id) return false;
                if (!user.blood_group || !req.blood_group) return false;
                if (!isBloodCompatible(user.blood_group, req.blood_group)) return false;
                return true;
            });
            setSmartMatches(matches);
        } else {
            setSmartMatches([]);
        }
    }, [requests, user, myDonations]);

    const loadStats = async () => {
        if (!user) return;
        try {
            setIsLoadingStats(true);
            const data = await fetchUserStats(user.id);
            setStats(data);
        } catch (error) {
            console.error('Error fetching stats', error);
        } finally {
            setIsLoadingStats(false);
        }
    };

    const isLoading = requestsLoading || isLoadingStats;

    // Get Highest Unlocked Badge for Rank
    const currentRank = stats?.achievements?.filter(a => a.unlocked).pop() || {
        name: 'New Hero',
        icon: 'heart',
        motto: 'Ready to save lives',
        unlocked: true
    };

    // Calculate Next Milestone
    // Find the first locked count-based badge
    const nextBadge = stats?.achievements?.find(a => !a.unlocked && a.type === 'count');

    // Helper: Next Eligibility
    const eligibility = calculateEligibility(stats?.last_donation_date || null);

    const getRankIcon = (iconName: string) => {
        switch (iconName) {
            case 'droplet': return DropletIcon;
            case 'shield': return Shield;
            case 'star': return Star;
            case 'trophy': return Trophy;
            default: return Heart;
        }
    };

    const RankIcon = getRankIcon(currentRank.icon || 'heart');

    // Helper to show PIN for pending donations (Redirects to requests)
    const handlePendingClick = (request: BloodRequest) => {
        router.push('/requests');
    };

    if (isLoading) {
        return <DashboardSkeleton />;
    }

    return (
        <div className="space-y-8">
            <NotificationBanner />
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
                    <p className="text-gray-600">Overview of your impact and matches</p>
                </div>
                <div className={`flex items-center space-x-2 px-4 py-2 rounded-full ${stats?.total_points ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'}`}>
                    <RankIcon className="h-5 w-5" />
                    <div className="flex flex-col leading-tight">
                        <span className="font-bold text-sm">{currentRank.name}</span>
                        {stats?.total_points !== undefined && (
                            <span className="text-xs opacity-80">{stats.total_points} Points</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Stats Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 1. Eligibility Card */}
                <Card className={eligibility.isEligible ? "border-l-4 border-l-green-500" : "border-l-4 border-l-orange-500"}>
                    <CardBody className="flex flex-col h-full justify-between">
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-semibold text-gray-700">Donation Status</h3>
                                <Calendar className={eligibility.isEligible ? "text-green-500" : "text-orange-500"} />
                            </div>
                            <p className={`text-xl font-bold ${eligibility.isEligible ? "text-green-600" : "text-orange-600"}`}>
                                {eligibility.isEligible ? "Ready to Donate" : "Recovery Period"}
                            </p>
                            <p className="text-sm text-gray-500 mt-1">
                                {eligibility.isEligible
                                    ? "You can save a life today!"
                                    : `Eligible in ${eligibility.daysRemaining} days`
                                }
                            </p>
                        </div>
                        {eligibility.isEligible && (
                            <Link href="/requests" className="mt-4">
                                <Button size="sm" variant="outline" className="w-full text-green-600 border-green-200 hover:bg-green-50">
                                    Find a Match
                                </Button>
                            </Link>
                        )}
                    </CardBody>
                </Card>

                {/* 2. Impact Score Card */}
                <Card>
                    <CardBody>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-gray-700">Impact Score</h3>
                            <Trophy className="text-amber-500" />
                        </div>
                        <div className="space-y-4">
                            <div>
                                <p className="text-3xl font-bold text-gray-900">{stats?.total_points || 0}</p>
                                <p className="text-sm text-gray-500">Current Points</p>
                            </div>
                            <div className="pt-4 border-t border-gray-100 flex justify-between text-sm">
                                <span className="text-gray-600">Lifetime Donations</span>
                                <span className="font-medium">{stats?.total_donations || 0}</span>
                            </div>
                        </div>
                    </CardBody>
                </Card>

                {/* 3. Next Milestone Card */}
                <Card className="bg-gradient-to-br from-indigo-600 to-indigo-700 text-white overflow-hidden relative">
                    {/* Decorative bg circle */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 pointer-events-none"></div>

                    <CardBody className="flex flex-col h-full justify-between text-white relative z-10">
                        {nextBadge ? (
                            <>
                                <div>
                                    <h3 className="font-semibold text-indigo-100 mb-2 flex items-center gap-2">
                                        <Target className="w-4 h-4" />
                                        Next Goal
                                    </h3>
                                    <div className="flex justify-between items-end mb-1">
                                        <p className="text-xl font-bold">{nextBadge.name}</p>
                                        <p className="text-sm font-medium text-indigo-200">
                                            {nextBadge.progress} / {nextBadge.threshold}
                                        </p>
                                    </div>

                                    {/* Progress Bar */}
                                    <div className="h-2 w-full bg-black/20 rounded-full overflow-hidden mb-2">
                                        <div
                                            className="h-full bg-white/90 rounded-full transition-all duration-1000"
                                            style={{ width: `${Math.min(100, (nextBadge.progress! / nextBadge.threshold!) * 100)}%` }}
                                        />
                                    </div>
                                    <p className="text-xs text-indigo-200">
                                        {nextBadge.threshold! - nextBadge.progress!} more donation(s) to unlock {nextBadge.points} pts
                                    </p>
                                </div>
                                <Link href="/achievements" className="mt-3">
                                    <Button variant="ghost" size="sm" className="w-full bg-white/10 text-white hover:bg-white/20 border-0 text-xs h-8">
                                        View All Badges
                                    </Button>
                                </Link>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-center py-2">
                                <Trophy className="w-10 h-10 text-yellow-300 mb-2" />
                                <p className="font-bold text-lg">Legend Status</p>
                                <p className="text-sm text-indigo-200">You've reached the top!</p>
                                <Link href="/achievements" className="mt-3 w-full">
                                    <Button variant="ghost" size="sm" className="w-full bg-white/10 text-white hover:bg-white/20 border-0 text-xs h-8">
                                        View Legacy
                                    </Button>
                                </Link>
                            </div>
                        )}
                    </CardBody>
                </Card>
            </div>

            {/* Smart Matches / Feed */}
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center">
                        <Heart className="h-5 w-5 mr-2 text-primary-500" />
                        Recommended for You
                    </h2>
                    <Link href="/requests" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                        See All Requests
                    </Link>
                </div>

                {smartMatches.length > 0 ? (
                    <div className="space-y-4">
                        {smartMatches.map(request => (
                            <BloodRequestCard
                                key={request.id}
                                request={request}
                                onRespond={() => router.push('/requests')}
                                onPendingClick={() => handlePendingClick(request)}
                                userBloodGroup={user?.blood_group}
                                hasOffered={myDonations.has(request.id)}
                                isOwnRequest={request.user_id === user?.id}
                            />
                        ))}
                    </div>
                ) : (
                    <EmptyState
                        icon={CheckCircle}
                        title="All Good!"
                        description={`There are no urgent requests matching your blood group (${user?.blood_group}) right now.`}
                        actionLabel="Browse All Requests"
                        onAction={() => router.push('/requests')}
                        className="bg-gray-50 border-dashed"
                    />
                )}
            </div>
        </div>
    );
}

const DropletIcon = ({ className }: { className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <path d="M12 22a7 7 0 0 0 7-7c0-2-2-3-2-3L12 2l-7 10s-2 1-2 3a7 7 0 0 0 7 7z" />
    </svg>
);
