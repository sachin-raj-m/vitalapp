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
import { Loader2, CheckCircle, Clock } from 'lucide-react';
import type { BloodRequest, Donation } from '@/types';

interface RequestWithDonations extends BloodRequest {
    donations: (Donation & { donor: { full_name: string; phone: string } })[];
}

export function MyRequestsContent() {
    const { user } = useAuth();
    const [requests, setRequests] = useState<RequestWithDonations[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    // Verification State
    const [verifyModal, setVerifyModal] = useState({ isOpen: false, donationId: '', requestId: '', donorName: '' });
    const [otpInput, setOtpInput] = useState('');
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
                        donor:profiles(full_name, phone)
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

    const handleVerify = async () => {
        setVerifying(true);
        setVerifyError('');

        try {
            // Check OTP against database
            const { data, error } = await supabase
                .from('donations')
                .select('otp')
                .eq('id', verifyModal.donationId)
                .single();

            if (error) throw error;

            if (data.otp === otpInput) {
                // Success! Update donation status to completed
                const { error: updateError } = await supabase
                    .from('donations')
                    .update({ status: 'completed' })
                    .eq('id', verifyModal.donationId);

                if (updateError) throw updateError;

                // Also mark the BLOOD REQUEST as fulfilled
                // logic: if donation is verified, the need is met.
                const { error: requestError } = await supabase
                    .from('blood_requests')
                    .update({ status: 'fulfilled' })
                    .eq('id', verifyModal.requestId);

                if (requestError) throw requestError;

                // Refresh list
                await fetchMyRequests();
                setVerifyModal({ isOpen: false, donationId: '', requestId: '', donorName: '' });
                setOtpInput('');
                alert('Donation verified and request closed successfully!');
            } else {
                setVerifyError('Invalid PIN. Please ask the donor for their correct PIN.');
            }
        } catch (err: any) {
            console.error('Verification error');
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

            {requests.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg shadow">
                    <p className="text-gray-500 mb-4">You haven't made any blood requests yet.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {requests.map((request) => (
                        <Card key={request.id}>
                            <CardHeader>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900">
                                            {request.blood_group} Blood Needed
                                        </h3>
                                        <p className="text-sm text-gray-500">{request.hospital_name}</p>
                                    </div>
                                    <Badge variant={request.status === 'active' ? 'warning' : 'success'}>
                                        {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardBody>
                                <h4 className="font-medium text-gray-900 mb-3">Donation Offers</h4>
                                {request.donations && request.donations.length > 0 ? (
                                    <div className="space-y-3">
                                        {request.donations.map((donation) => (
                                            <div
                                                key={donation.id}
                                                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold">
                                                        {donation.donor?.full_name?.charAt(0) || 'D'}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-gray-900">{donation.donor?.full_name || 'Anonymous'}</p>
                                                        <p className="text-sm text-gray-500">{donation.donor?.phone}</p>
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
                                                                donorName: donation.donor?.full_name
                                                            })}
                                                        >
                                                            Verify OTP
                                                        </Button>
                                                    ) : (
                                                        <span className="flex items-center text-green-600 text-sm font-medium">
                                                            <CheckCircle className="h-4 w-4 mr-1" /> Verified
                                                        </span>
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
                    ))}
                </div>
            )}

            {/* Verification Modal */}
            <Modal
                isOpen={verifyModal.isOpen}
                onClose={() => setVerifyModal({ ...verifyModal, isOpen: false })}
                title={`Verify Donation from ${verifyModal.donorName}`}
            >
                <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                        Ask the donor for their <strong>4-digit Donor PIN</strong> and enter it below to confirm the donation.
                        <br />
                        <span className="text-xs text-orange-600 font-medium mt-1 block">
                            Note: verifying this will mark the request as fulfilled.
                        </span>
                    </p>

                    <Input
                        label="Enter Donor PIN"
                        placeholder="e.g. 1234"
                        value={otpInput}
                        onChange={(e) => setOtpInput(e.target.value)}
                        maxLength={4}
                        className="text-center text-2xl tracking-widest"
                    />

                    {verifyError && (
                        <p className="text-red-500 text-sm">{verifyError}</p>
                    )}

                    <div className="flex justify-end gap-3 pt-2">
                        <Button
                            variant="secondary"
                            onClick={() => setVerifyModal({ ...verifyModal, isOpen: false })}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleVerify}
                            isLoading={verifying}
                            disabled={otpInput.length !== 4}
                        >
                            Verify & Complete
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
