"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Activity, Users, AlertCircle, TrendingUp, Calendar, Heart, Shield, Award, CheckCircle } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { BloodRequestCard } from '@/components/BloodRequestCard';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import type { BloodRequest } from '@/types';
import { isBloodCompatible } from '@/lib/blood-compatibility';
import { formatDistanceToNow, addDays, differenceInDays } from 'date-fns';

import { useRequests } from '@/context/RequestsContext';

// ... (other imports remain, remove BloodRequest type import if unused or keep)

export default function DashboardPage() {
    const { user } = useAuth();
    const router = useRouter();
    const { requests, myDonations, loading: requestsLoading } = useRequests(); // Use global state

    // Local state for user-specific stats only
    const [stats, setStats] = useState({
        completedDonations: 0,
        livesImpacted: 0
    });
    const [smartMatches, setSmartMatches] = useState<BloodRequest[]>([]);
    const [lastDonationDate, setLastDonationDate] = useState<Date | null>(null);
    const [userStatsLoading, setUserStatsLoading] = useState(true);

    useEffect(() => {
        if (user) {
            fetchUserStats();
        }
    }, [user]);

    // Recalculate smart matches whenever requests or user changes
    useEffect(() => {
        if (requests.length > 0 && user?.blood_group) {
            const matches = requests.filter(req => {
                // 1. Own Request Filter
                if (req.user_id === user.id) return false;

                // 2. Compatibility Filter
                if (!user.blood_group || !req.blood_group) return false;

                if (!isBloodCompatible(user.blood_group, req.blood_group)) return false;

                // 3. Show all compatible matches, even if already offered (handled by card UI)
                return true;
            });
            setSmartMatches(matches);
        } else {
            setSmartMatches([]);
        }
    }, [requests, user, myDonations]);

    const fetchUserStats = async () => {
        if (!user) return;
        try {
            setUserStatsLoading(true);

            // Fetch User's Donation History for Eligibility & Gamification
            const { data: donations } = await supabase
                .from('donations')
                .select('*')
                .eq('donor_id', user.id)
                .eq('status', 'completed')
                .order('created_at', { ascending: false });

            // Calculate Stats
            const completedCount = donations?.length || 0;
            const lastDonation = donations?.[0] ? new Date(donations[0].created_at) : null;

            setStats({
                completedDonations: completedCount,
                livesImpacted: completedCount * 3
            });

            setLastDonationDate(lastDonation);

        } catch (error) {
            console.error('Error fetching dashboard user stats', error);
        } finally {
            setUserStatsLoading(false);
        }
    };

    const isLoading = requestsLoading || userStatsLoading;


    // Helper: Determine Donor Level
    const getDonorLevel = (count: number) => {
        if (count >= 10) return { name: 'Gold Donor', color: 'text-yellow-600 bg-yellow-100', icon: Shield };
        if (count >= 5) return { name: 'Silver Donor', color: 'text-gray-600 bg-gray-100', icon: Shield };
        if (count >= 1) return { name: 'Bronze Donor', color: 'text-orange-700 bg-orange-100', icon: Award };
        return { name: 'New Donor', color: 'text-blue-600 bg-blue-100', icon: Heart };
    };

    const donorLevel = getDonorLevel(stats.completedDonations);
    const LevelIcon = donorLevel.icon;

    // Helper: Eligibility logic
    const getEligibilityStatus = () => {
        if (!lastDonationDate) return { isReady: true, message: "You are ready to donate today!" };

        const nextDate = addDays(lastDonationDate, 56);
        const today = new Date();

        if (today >= nextDate) {
            return { isReady: true, message: "You are ready to donate again!" };
        } else {
            const daysLeft = differenceInDays(nextDate, today);
            return { isReady: false, message: `Eligible in ${daysLeft} days`, nextDate };
        }
    };

    const eligibility = getEligibilityStatus();

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
                    <p className="text-gray-600">Overview of your impact and matches</p>
                </div>
                <div className={`flex items-center space-x-2 px-4 py-2 rounded-full ${donorLevel.color}`}>
                    <LevelIcon className="h-5 w-5" />
                    <span className="font-semibold">{donorLevel.name}</span>
                </div>
            </div>

            {/* Smart Status Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 1. Eligibility Card */}
                <Card className={eligibility.isReady ? "border-l-4 border-l-success-500" : "border-l-4 border-l-orange-500"}>
                    <CardBody className="flex flex-col h-full justify-between">
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-semibold text-gray-700">Donation Status</h3>
                                <Calendar className={eligibility.isReady ? "text-success-500" : "text-orange-500"} />
                            </div>
                            <p className={`text-xl font-bold ${eligibility.isReady ? "text-success-600" : "text-orange-600"}`}>
                                {eligibility.isReady ? "Ready to Donate" : "Recovery Period"}
                            </p>
                            <p className="text-sm text-gray-500 mt-1">{eligibility.message}</p>
                        </div>
                        {eligibility.isReady && (
                            <Link href="/requests" className="mt-4">
                                <Button size="sm" variant="outline" className="w-full text-success-600 border-success-200 hover:bg-success-50">
                                    Find a Match
                                </Button>
                            </Link>
                        )}
                    </CardBody>
                </Card>

                {/* 2. Impact Card */}
                <Card>
                    <CardBody>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-gray-700">Your Impact</h3>
                            <Activity className="text-primary-500" />
                        </div>
                        <div className="space-y-4">
                            <div>
                                <p className="text-3xl font-bold text-gray-900">{stats.livesImpacted}</p>
                                <p className="text-sm text-gray-500">Estimated lives saved</p>
                            </div>
                            <div className="pt-4 border-t border-gray-100 flex justify-between text-sm">
                                <span className="text-gray-600">Donations made</span>
                                <span className="font-medium">{stats.completedDonations}</span>
                            </div>
                        </div>
                    </CardBody>
                </Card>

                {/* 3. Quick Action / Pulse */}
                <Card className="bg-gradient-to-br from-primary-600 to-primary-700 text-white">
                    <CardBody className="flex flex-col h-full justify-between text-white">
                        <div>
                            <h3 className="font-semibold text-primary-100 mb-2">Community Needs</h3>
                            <p className="text-2xl font-bold mb-1">{requests.length} Active Requests</p>
                            <p className="text-sm text-primary-100 opacity-90">
                                {smartMatches.length > 0
                                    ? <span className="font-bold bg-white/20 px-2 py-0.5 rounded text-white">{smartMatches.length} Matches For You</span>
                                    : "No compatible requests right now"}
                            </p>
                        </div>
                        <Link href="/requests/new" className="mt-4">
                            <Button variant="secondary" className="w-full bg-white text-primary-700 hover:bg-gray-100 border-0">
                                Request Blood
                            </Button>
                        </Link>
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
                                // Simple view only, detailed interaction happens on click or reuse existing logic if needed
                                // Passing props to enable interaction if we want "Quick Donate"
                                onRespond={() => router.push('/requests')} // Redirect to main page for full flow or keep it simple
                                userBloodGroup={user?.blood_group}
                                hasOffered={myDonations.has(request.id)}
                                isOwnRequest={request.user_id === user?.id} // Defensive: Ensure own requests are marked
                            // We don't fetch 'offered' state here to keep dashboard light, so maybe just link to details?
                            // Let's use a simpler "View" action or assume redirection.
                            // Actually better to render it fully but disable complex tailored logic to avoid overhead?
                            // Let's pass a dummy onRespond that navigates to requests page to be safe
                            />
                        ))}
                    </div>
                ) : (
                    <Card className="bg-gray-50 border-dashed">
                        <CardBody className="text-center py-8">
                            <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                                <CheckCircle className="h-6 w-6 text-gray-400" />
                            </div>
                            <h3 className="text-lg font-medium text-gray-900">All Good!</h3>
                            <p className="text-gray-500 max-w-sm mx-auto">
                                There are no urgent requests matching your blood group ({user?.blood_group}) right now.
                            </p>
                            <Link href="/requests" className="mt-4 inline-block">
                                <Button variant="outline">Browse All Requests</Button>
                            </Link>
                        </CardBody>
                    </Card>
                )}
            </div>
        </div>
    );
}
