"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Activity, Users, AlertCircle, Clock, TrendingUp } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { BloodRequestCard } from '@/components/BloodRequestCard';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import type { BloodRequest } from '@/types';

export default function DashboardPage() {
    const { user } = useAuth();
    const [stats, setStats] = useState({
        totalRequests: 0,
        activeRequests: 0,
        potentialDonors: 0,
        urgentRequests: 0
    });
    const [recentRequests, setRecentRequests] = useState<BloodRequest[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);

            // Fetch statistics
            const { data: activeRequests } = await supabase
                .from('blood_requests')
                .select('id', { count: 'exact' })
                .eq('status', 'active');

            const { data: urgentRequests } = await supabase
                .from('blood_requests')
                .select('id', { count: 'exact' })
                .eq('status', 'active')
                .eq('urgency_level', 'High');

            const { data: donors } = await supabase
                .from('profiles')
                .select('id', { count: 'exact' })
                .eq('is_donor', true);

            // Fetch recent requests
            const { data: recent } = await supabase
                .from('blood_requests')
                .select('*')
                .eq('status', 'active')
                .order('created_at', { ascending: false })
                .limit(5);

            setStats({
                totalRequests: activeRequests?.length || 0,
                activeRequests: activeRequests?.length || 0,
                potentialDonors: donors?.length || 0,
                urgentRequests: urgentRequests?.length || 0
            });

            if (recent) {
                setRecentRequests(recent as BloodRequest[]);
            }
        } catch (error) {
            console.error('Error fetching dashboard data');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
                    <p className="text-gray-600">Welcome back, {user?.full_name}</p>
                </div>
                <Link href="/requests/new">
                    <Button variant="primary" leftIcon={<AlertCircle className="h-5 w-5" />}>
                        Create Blood Request
                    </Button>
                </Link>
            </div>

            <div className="grid md:grid-cols-4 gap-6">
                <Card>
                    <CardBody className="flex items-center space-x-4">
                        <div className="p-3 bg-primary-100 rounded-full">
                            <Activity className="h-6 w-6 text-primary-500" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Active Requests</p>
                            <p className="text-2xl font-bold text-gray-900">{stats.activeRequests}</p>
                        </div>
                    </CardBody>
                </Card>

                <Card>
                    <CardBody className="flex items-center space-x-4">
                        <div className="p-3 bg-warning-100 rounded-full">
                            <AlertCircle className="h-6 w-6 text-warning-500" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Urgent Needs</p>
                            <p className="text-2xl font-bold text-gray-900">{stats.urgentRequests}</p>
                        </div>
                    </CardBody>
                </Card>

                <Card>
                    <CardBody className="flex items-center space-x-4">
                        <div className="p-3 bg-success-100 rounded-full">
                            <Users className="h-6 w-6 text-success-500" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Potential Donors</p>
                            <p className="text-2xl font-bold text-gray-900">{stats.potentialDonors}</p>
                        </div>
                    </CardBody>
                </Card>

                <Card>
                    <CardBody className="flex items-center space-x-4">
                        <div className="p-3 bg-secondary-100 rounded-full">
                            <TrendingUp className="h-6 w-6 text-secondary-500" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Total Requests</p>
                            <p className="text-2xl font-bold text-gray-900">{stats.totalRequests}</p>
                        </div>
                    </CardBody>
                </Card>
            </div>

            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-gray-900">Recent Blood Requests</h2>
                    <Link href="/requests" className="text-primary-500 hover:text-primary-600 font-medium">
                        View All
                    </Link>
                </div>

                {recentRequests.length > 0 ? (
                    <div className="space-y-4">
                        {recentRequests.map(request => (
                            <BloodRequestCard
                                key={request.id}
                                request={request}
                                onRespond={() => { }}
                            />
                        ))}
                    </div>
                ) : (
                    <Card>
                        <CardBody className="text-center py-8">
                            <p className="text-gray-600">No active blood requests</p>
                            <Link href="/requests/new" className="mt-4 inline-block">
                                <Button variant="primary">Create First Request</Button>
                            </Link>
                        </CardBody>
                    </Card>
                )}
            </div>
        </div>
    );
}
