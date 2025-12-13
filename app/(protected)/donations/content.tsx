"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Loader2, Calendar } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';

interface DonationWithRequest {
    id: string;
    created_at: string;
    status: string;
    request: {
        hospital_name: string;
    } | null;
}

export default function DonationsPage() {
    const { user } = useAuth();
    const [donations, setDonations] = useState<DonationWithRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchDonations = async () => {
            if (!user) return;

            try {
                const { data, error } = await supabase
                    .from('donations')
                    .select(`
                        id,
                        created_at,
                        status,
                        request:blood_requests (
                            hospital_name
                        )
                    `)
                    .eq('donor_id', user.id)
                    .order('created_at', { ascending: false });

                if (error) throw error;

                // Transform data to match interface (handle potential array from join)
                const formattedData = (data || []).map((item: any) => ({
                    ...item,
                    request: Array.isArray(item.request) ? item.request[0] : item.request
                }));

                setDonations(formattedData);
            } catch (err: any) {
                console.error('Error fetching donations:', err);
                setError('Failed to load donation history');
            } finally {
                setIsLoading(false);
            }
        };

        fetchDonations();
    }, [user]);

    const completedDonations = donations.filter(d => d.status === 'completed');
    const totalDonations = completedDonations.length;
    const pointsEarned = totalDonations * 50; // 50 points per donation

    const getLastDonationDate = () => {
        if (completedDonations.length === 0) return null;
        return new Date(completedDonations[0].created_at);
    };

    const getNextAvailableDate = () => {
        const lastDate = getLastDonationDate();
        if (!lastDate) return new Date(); // Available now if never donated

        const nextDate = new Date(lastDate);
        nextDate.setDate(nextDate.getDate() + 56); // 56 days gap
        return nextDate;
    };

    const nextAvailable = getNextAvailableDate();
    const isAvailableNow = nextAvailable <= new Date();

    if (isLoading) {
        return (
            <div className="flex justify-center items-center min-h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold text-gray-900">My Donations</h1>

            {error && (
                <Alert variant="error" className="mb-4">
                    {error}
                </Alert>
            )}

            <div className="grid md:grid-cols-3 gap-6">
                <Card>
                    <CardHeader>
                        <h3 className="text-lg font-medium text-gray-900">Total Donations</h3>
                    </CardHeader>
                    <CardBody>
                        <div className="text-3xl font-bold text-primary-500">{totalDonations}</div>
                        <p className="text-sm text-gray-500">Lives impacted</p>
                    </CardBody>
                </Card>

                <Card>
                    <CardHeader>
                        <h3 className="text-lg font-medium text-gray-900">Points Earned</h3>
                    </CardHeader>
                    <CardBody>
                        <div className="text-3xl font-bold text-secondary-500">{pointsEarned}</div>
                        <p className="text-sm text-gray-500">Reward points</p>
                    </CardBody>
                </Card>

                <Card>
                    <CardHeader>
                        <h3 className="text-lg font-medium text-gray-900">Next Available</h3>
                    </CardHeader>
                    <CardBody>
                        <div className={`text-3xl font-bold ${isAvailableNow ? 'text-success-500' : 'text-orange-500'}`}>
                            {isAvailableNow ? 'Ready' : nextAvailable.toLocaleDateString()}
                        </div>
                        <p className="text-sm text-gray-500">
                            {isAvailableNow ? 'You can donate again' : 'Next eligible date'}
                        </p>
                    </CardBody>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <h3 className="text-lg font-medium text-gray-900">Donation History</h3>
                </CardHeader>
                <CardBody>
                    {donations.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            No donations found. Your journey starts with the first step!
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {donations.map((donation) => (
                                <div key={donation.id} className="flex items-center justify-between p-4 border-b last:border-0">
                                    <div>
                                        <p className="font-medium">
                                            {donation.request?.hospital_name || 'Unknown Hospital'}
                                        </p>
                                        <p className="text-sm text-gray-500 flex items-center mt-1">
                                            <Calendar className="h-3 w-3 mr-1" />
                                            {new Date(donation.created_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <Badge variant={donation.status === 'completed' ? 'success' : 'warning'}>
                                        {donation.status.charAt(0).toUpperCase() + donation.status.slice(1)}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    )}
                </CardBody>
            </Card>
        </div>
    );
}
