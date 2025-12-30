"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/context/AuthContext';
import { useRequests } from '@/context/RequestsContext';
import { supabase } from '@/lib/supabase';
import { Loader2, Calendar, XCircle, Heart } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { EmptyState } from '@/components/EmptyState';

import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { toast } from 'sonner';

interface DonationWithRequest {
    id: string;
    created_at: string;
    status: string;
    request: {
        hospital_name: string;
        status?: string;
    } | null;
}

export default function DonationsPage() {
    const { user } = useAuth();
    const { refreshRequests } = useRequests();
    const [donations, setDonations] = useState<DonationWithRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
    const [donationToWithdraw, setDonationToWithdraw] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | 'pending' | 'verified' | 'closed'>('all');

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
                            hospital_name,
                            status
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
                console.error('Error fetching donations');
                setError('Failed to load donation history');
            } finally {
                setIsLoading(false);
            }
        };

        fetchDonations();
    }, [user]);

    const performWithdraw = async () => {
        if (!donationToWithdraw) return;

        setWithdrawingId(donationToWithdraw);
        try {
            const { error } = await supabase
                .from('donations')
                .update({ status: 'cancelled' })
                .eq('id', donationToWithdraw);

            if (error) throw error;

            // Update local state
            setDonations(prev => prev.map(d =>
                d.id === donationToWithdraw ? { ...d, status: 'cancelled' } : d
            ));

            // Refresh global context to update "Offer Sent" buttons elsewhere
            await refreshRequests();
            toast.success("Donation offer withdrawn successfully");
        } catch (err: any) {
            console.error('Error withdrawing donation', err);
            toast.error('Failed to withdraw donation');
        } finally {
            setWithdrawingId(null);
            setDonationToWithdraw(null);
        }
    };

    const getDisplayStatus = (donation: DonationWithRequest) => {
        if (donation.status === 'completed') return { label: 'Verified', variant: 'success' as const };
        if (donation.status === 'cancelled') return { label: 'Withdrawn', variant: 'neutral' as const };

        // Donation is pending, check request status
        if (donation.request?.status === 'fulfilled' || donation.request?.status === 'closed') {
            return { label: 'Request Fulfilled', variant: 'neutral' as const };
        }

        return { label: 'Pending', variant: 'warning' as const };
    };

    const getFilteredDonations = () => {
        return donations.filter(d => {
            const status = getDisplayStatus(d).label;
            if (filter === 'all') return true;
            if (filter === 'pending') return status === 'Pending';
            if (filter === 'verified') return status === 'Verified';
            if (filter === 'closed') return status === 'Request Fulfilled' || status === 'Withdrawn';
            return true;
        });
    };

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

    const filteredDonations = getFilteredDonations();

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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <h3 className="text-lg font-medium text-gray-900">Donation History</h3>
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                        {(['all', 'pending', 'verified', 'closed'] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setFilter(tab)}
                                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${filter === tab
                                    ? 'bg-white text-gray-900 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </button>
                        ))}
                    </div>
                </CardHeader>
                <CardBody>
                    {filteredDonations.length === 0 ? (
                        <EmptyState
                            icon={Heart}
                            title={filter === 'all' ? "No donations found" : `No ${filter} donations`}
                            description={filter === 'all' ? "Your journey starts here. Find a request to help." : "Try changing the filter."}
                            actionLabel={filter === 'all' ? "Find Requests" : undefined}
                            className="bg-white border-none shadow-none py-8"
                            onAction={() => window.location.href = '/requests'}
                        />
                    ) : (
                        <div className="space-y-4">
                            {filteredDonations.map((donation) => {
                                const displayStatus = getDisplayStatus(donation);
                                return (
                                    <div key={donation.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border-b last:border-0 gap-3">
                                        <div>
                                            <p className="font-medium">
                                                {donation.request?.hospital_name || 'Unknown Hospital'}
                                            </p>
                                            <p className="text-sm text-gray-500 flex items-center mt-1">
                                                <Calendar className="h-3 w-3 mr-1" />
                                                {new Date(donation.created_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
                                            <Badge variant={displayStatus.variant}>
                                                {displayStatus.label}
                                            </Badge>

                                            {/* Show descriptive text for fulfilled requests if selected or just generally helpful */}
                                            {displayStatus.label === 'Request Fulfilled' && (
                                                <span className="text-xs text-gray-500 hidden sm:inline-block">
                                                    Donated by someone else
                                                </span>
                                            )}

                                            {displayStatus.label === 'Pending' && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="text-red-600 border-red-200 hover:bg-red-50"
                                                    onClick={() => setDonationToWithdraw(donation.id)}
                                                    isLoading={withdrawingId === donation.id}
                                                >
                                                    Withdraw
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardBody>
            </Card>

            <ConfirmationModal
                isOpen={!!donationToWithdraw}
                onClose={() => setDonationToWithdraw(null)}
                onConfirm={performWithdraw}
                title="Withdraw Donation Offer"
                description="Are you sure you want to withdraw this donation offer? The requester will be notified."
                confirmText="Withdraw Offer"
                variant="danger"
                isLoading={!!withdrawingId}
            />
        </div>
    );
}
