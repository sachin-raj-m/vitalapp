"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Loader2, CheckCircle, Clock, Trash2 } from 'lucide-react';
import type { BloodRequest, Donation } from '@/types';
import { EmptyState } from '@/components/EmptyState';
import { logActivity } from '@/lib/logger';

interface RequestWithDonations extends BloodRequest {
    donations: (Donation & { profiles: { full_name: string; phone: string }, units_donated: number })[];
}

export function MyRequestsContent() {
    const { user } = useAuth();
    const [requests, setRequests] = useState<RequestWithDonations[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState<'active' | 'past'>('active');

    // New state for delete operation
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const filteredRequests = requests.filter(req => {
        if (activeTab === 'active') return req.status === 'active';
        return req.status === 'fulfilled' || req.status === 'cancelled';
    });

    // Verification State
    const [verifyModal, setVerifyModal] = useState({ isOpen: false, donationId: '', requestId: '', donorName: '', maxUnits: 0 });
    const [otpInput, setOtpInput] = useState('');
    const [unitsDonatedInput, setUnitsDonatedInput] = useState(1);
    const [verifying, setVerifying] = useState(false);
    const [verifyError, setVerifyError] = useState('');

    useEffect(() => {
        fetchMyRequests();
    }, [user]);

    const fetchMyRequests = async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from('blood_requests')
                .select(`
                    *,
                    donations:donations(
                        *,
                        profiles(full_name, phone)
                    )
                `)
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setRequests(data as any);
        } catch (err: any) {
            console.error('Error fetching requests');
            setError('Failed to load your requests');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (requestId: string) => {
        if (!confirm('Are you sure you want to delete this request? This action cannot be undone.')) return;
        if (!user) return;

        setDeletingId(requestId);
        try {
            const { error } = await supabase
                .from('blood_requests')
                .delete()
                .eq('id', requestId);

            if (error) throw error;

            await logActivity({
                userId: user.id,
                action: 'DELETE_REQUEST',
                entityType: 'blood_requests',
                entityId: requestId,
                metadata: { timestamp: new Date().toISOString() }
            });

            await fetchMyRequests();
            alert('Request deleted successfully.');
        } catch (err: any) {
            console.error('Delete error', err);
            alert('Failed to delete request.');
        } finally {
            setDeletingId(null);
        }
    };

    const handleVerify = async () => {
        setVerifying(true);
        setVerifyError('');

        try {
            // Check OTP against database
            const { data: donationData, error: otpError } = await supabase
                .from('donations')
                .select('otp, request_id')
                .eq('id', verifyModal.donationId)
                .single();

            if (otpError) throw otpError;

            if (donationData.otp === otpInput) {
                // 1. Update donation status and units
                const updatePayload = {
                    status: 'completed',
                    units_donated: unitsDonatedInput
                };

                const { error: updateError, count } = await supabase
                    .from('donations')
                    .update(updatePayload, { count: 'exact' })
                    .eq('id', verifyModal.donationId);

                if (updateError) throw updateError;
                if (count === 0) throw new Error('Permission denied updating donation.');

                // Log Verification
                if (user) {
                    await logActivity({
                        userId: user.id,
                        action: 'VERIFY_DONATION',
                        entityType: 'donations',
                        entityId: verifyModal.donationId,
                        metadata: {
                            requestId: verifyModal.requestId,
                            unitsDonated: unitsDonatedInput
                        }
                    });
                }

                // 2. Check total collected units
                const { data: allDonations, error: sumError } = await supabase
                    .from('donations')
                    .select('units_donated')
                    .eq('request_id', verifyModal.requestId)
                    .eq('status', 'completed');

                if (sumError) throw sumError;

                const totalCollected = allDonations.reduce((sum, d) => sum + (d.units_donated || 0), 0);
                const request = requests.find(r => r.id === verifyModal.requestId);
                const unitsNeeded = request?.units_needed || 0;

                let message = 'Donation verified successfully!';

                // 3. Auto-fulfill if enough units collected
                if (totalCollected >= unitsNeeded) {
                    const { error: requestError } = await supabase
                        .from('blood_requests')
                        .update({ status: 'fulfilled' })
                        .eq('id', verifyModal.requestId);

                    if (requestError) {
                        console.error('Request Fulfillment Error:', requestError);
                        message += ' (Warning: Failed to auto-close request)';
                    } else {
                        message += ' Request has been fulfilled and closed.';
                        if (user) {
                            await logActivity({
                                userId: user.id,
                                action: 'FULFILL_REQUEST',
                                entityType: 'blood_requests',
                                entityId: verifyModal.requestId,
                                metadata: { totalUnits: totalCollected }
                            });
                        }
                    }
                } else {
                    message += ` Progress: ${totalCollected}/${unitsNeeded} units.`;
                }

                await fetchMyRequests();
                setVerifyModal({ isOpen: false, donationId: '', requestId: '', donorName: '', maxUnits: 0 });
                setOtpInput('');
                setUnitsDonatedInput(1);
                setTimeout(() => alert(message), 100);

            } else {
                setVerifyError('Invalid PIN.');
            }
        } catch (err: any) {
            console.error('Verification error', err);
            setVerifyError(err.message || 'Verification failed');
        } finally {
            setVerifying(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center min-h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold text-gray-900">My Requests</h1>

            {error && <Alert variant="error">{error}</Alert>}

            {/* Tabs */}
            <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
                <button
                    onClick={() => setActiveTab('active')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'active'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    Active Requests
                </button>
                <button
                    onClick={() => setActiveTab('past')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'past'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    Past Requests
                </button>
            </div>

            {filteredRequests.length === 0 ? (
                <EmptyState
                    icon={Clock}
                    title={activeTab === 'active' ? "No Active Requests" : "No Past Requests"}
                    description={activeTab === 'active'
                        ? "You don't have any active blood requests. If you or a loved one needs help, create a request now."
                        : "You haven't made any requests in the past."}
                    actionLabel={activeTab === 'active' ? "Create Request" : undefined}
                    onAction={activeTab === 'active' ? () => window.location.href = '/requests/new' : undefined}
                />
            ) : (
                <div className="space-y-6">
                    {filteredRequests.map((request) => {
                        const fulfilledUnits = request.donations.filter(d => d.status === 'completed').reduce((sum, d) => sum + (d.units_donated || 1), 0);
                        const isPast = request.status !== 'active';

                        return (
                            <Card key={request.id}>
                                <CardHeader>
                                    <div className="flex flex-col md:flex-row justify-between items-start gap-2">
                                        <div className="flex-grow">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h3 className="text-lg font-bold text-gray-900">
                                                        {request.blood_group} Blood Needed
                                                    </h3>
                                                    <p className="text-sm text-gray-500">{request.hospital_name}</p>
                                                </div>
                                                {isPast && (
                                                    <div className="text-right text-sm text-gray-500 hidden md:block">
                                                        <div>Posted: {new Date(request.created_at).toLocaleDateString()}</div>
                                                        {request.status === 'fulfilled' && (
                                                            <div>Fulfilled: {new Date(request.updated_at).toLocaleDateString()}</div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {!isPast && (
                                                <div className="mt-3 flex flex-wrap gap-4 text-sm bg-gray-50 p-3 rounded-lg border border-gray-100">
                                                    <div className="flex flex-col">
                                                        <span className="text-gray-500 text-xs uppercase font-semibold">Units Required</span>
                                                        <span className="font-medium text-gray-900">{request.units_needed} Units</span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-gray-500 text-xs uppercase font-semibold">Collected</span>
                                                        <span className="font-medium text-success-600">{fulfilledUnits} Units</span>
                                                    </div>
                                                    {request.date_needed && (
                                                        <div className="flex flex-col">
                                                            <span className="text-gray-500 text-xs uppercase font-semibold">Date Needed</span>
                                                            <span className="font-medium text-gray-900">{new Date(request.date_needed).toLocaleDateString()}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-col items-end gap-1 self-end md:self-auto pl-4">
                                            <div className="flex items-center gap-2">
                                                <Badge variant={request.status === 'active' ? 'warning' : request.status === 'fulfilled' ? 'success' : 'neutral'}>
                                                    {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                                                </Badge>
                                                {request.status === 'active' && (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 h-auto"
                                                        onClick={() => handleDelete(request.id)}
                                                        isLoading={deletingId === request.id}
                                                        title="Delete Request"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                )}
                                            </div>

                                            {request.status === 'active' && (
                                                <div className="w-32 mt-1">
                                                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                                                        <span>Collected</span>
                                                        <span>{fulfilledUnits} / {request.units_needed}</span>
                                                    </div>
                                                    <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-green-500 rounded-full"
                                                            style={{
                                                                width: `${Math.min(100, (fulfilledUnits / request.units_needed) * 100)}%`
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardBody>
                                    <h4 className="font-medium text-gray-900 mb-3">Donation Offers</h4>
                                    {request.donations && request.donations.length > 0 ? (
                                        <div className="space-y-3">
                                            {request.donations.map((donation) => (
                                                <div
                                                    key={donation.id}
                                                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100 gap-3"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold">
                                                            {donation.profiles?.full_name?.charAt(0) || 'D'}
                                                        </div>
                                                        <div>
                                                            <p className="font-medium text-gray-900">{donation.profiles?.full_name || 'Anonymous'}</p>
                                                            <p className="text-sm text-gray-500">
                                                                {request.status === 'active'
                                                                    ? donation.profiles?.phone
                                                                    : <span className="text-gray-400 italic">Contact Hidden</span>}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        {donation.status === 'pending' ? (
                                                            <Button
                                                                size="sm"
                                                                onClick={() => setVerifyModal({
                                                                    isOpen: true,
                                                                    donationId: donation.id,
                                                                    requestId: request.id,
                                                                    donorName: donation.profiles?.full_name,
                                                                    maxUnits: request.units_needed - fulfilledUnits
                                                                })}
                                                            >
                                                                Verify PIN
                                                            </Button>
                                                        ) : donation.status === 'completed' ? (
                                                            <span className="flex items-center text-green-600 text-sm font-medium">
                                                                <CheckCircle className="h-4 w-4 mr-1" /> Verified
                                                            </span>
                                                        ) : (
                                                            <Badge variant="neutral">{donation.status}</Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-gray-500 text-sm italic">No offers yet.</p>
                                    )}
                                </CardBody>
                            </Card>
                        );
                    })}
                </div>
            )}

            <Modal
                isOpen={verifyModal.isOpen}
                onClose={() => setVerifyModal({ ...verifyModal, isOpen: false })}
                title={`Verify Donation from ${verifyModal.donorName}`}
            >
                <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                        Ask the donor for their <strong>4-digit Donor PIN</strong> and enter it below to confirm.
                    </p>
                    <Input
                        label="Enter Donor PIN"
                        placeholder="e.g. 1234"
                        value={otpInput}
                        onChange={(e) => setOtpInput(e.target.value)}
                        maxLength={4}
                        className="text-center text-2xl tracking-widest"
                    />
                    <div className="bg-blue-50 p-4 rounded-lg">
                        <label className="block text-sm font-medium text-blue-900 mb-2">Units Donated</label>
                        <div className="flex items-center gap-3">
                            <button className="w-10 h-10 border border-blue-200 text-blue-600 font-bold hover:bg-blue-100" onClick={() => setUnitsDonatedInput(Math.max(1, unitsDonatedInput - 1))}>-</button>
                            <span className="text-xl font-bold">{unitsDonatedInput}</span>
                            <button className="w-10 h-10 border border-blue-200 text-blue-600 font-bold hover:bg-blue-100" onClick={() => setUnitsDonatedInput(unitsDonatedInput + 1)}>+</button>
                        </div>
                    </div>
                    {verifyError && <p className="text-red-500 text-sm">{verifyError}</p>}
                    <div className="flex justify-end gap-3 pt-2">
                        <Button variant="secondary" onClick={() => setVerifyModal({ ...verifyModal, isOpen: false })}>Cancel</Button>
                        <Button onClick={handleVerify} isLoading={verifying} disabled={otpInput.length !== 4}>Verify & Complete</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
