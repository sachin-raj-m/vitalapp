"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { BloodRequestCard } from '@/components/BloodRequestCard';
import { MapPin, List } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';

const Map = dynamic(() => import('@/components/Map'), {
    ssr: false,
    loading: () => <div className="h-[400px] bg-gray-100 rounded-lg animate-pulse" />
});
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import type { BloodRequest } from '@/types';

export default function RequestsPage() {
    const { user } = useAuth();
    const [requests, setRequests] = useState<BloodRequest[]>([]);
    const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [filters, setFilters] = useState({
        bloodGroup: 'all',
        urgency: 'all',
        location: ''
    });

    useEffect(() => {
        fetchRequests();
    }, []);

    const fetchRequests = async () => {
        try {
            setLoading(true);
            let query = supabase
                .from('blood_requests')
                .select('*')
                .eq('status', 'active')
                .order('created_at', { ascending: false });

            if (filters.bloodGroup !== 'all') {
                query = query.eq('blood_group', filters.bloodGroup);
            }
            if (filters.urgency !== 'all') {
                query = query.eq('urgency_level', filters.urgency);
            }
            // TODO: Implement location filtering

            const { data, error: requestError } = await query;

            if (requestError) throw requestError;
            setRequests(data as BloodRequest[]);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const [otpModal, setOtpModal] = useState({ isOpen: false, pin: '', hospitalName: '' });
    const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; request: BloodRequest | null }>({ isOpen: false, request: null });
    const [createPinModal, setCreatePinModal] = useState<{ isOpen: boolean; request: BloodRequest | null }>({ isOpen: false, request: null });
    const [newPin, setNewPin] = useState('');
    const [creatingPin, setCreatingPin] = useState(false);
    const { refreshProfile } = useAuth(); // Assuming refreshProfile is available in useAuth

    const handleDonateClick = async (request: BloodRequest) => {
        if (!user) {
            setError('Please login to donate');
            return;
        }

        // Check if user has a PIN
        if (!user.donor_pin) {
            setCreatePinModal({ isOpen: true, request });
        } else {
            setConfirmModal({ isOpen: true, request });
        }
    };

    const handleCreatePin = async () => {
        if (!user || newPin.length !== 4) return;
        setCreatingPin(true);
        try {
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ donor_pin: newPin })
                .eq('id', user.id);

            if (updateError) throw updateError;

            await refreshProfile(); // Refresh profile to get the new PIN in context

            setCreatePinModal({ isOpen: false, request: null });
            if (createPinModal.request) {
                setConfirmModal({ isOpen: true, request: createPinModal.request });
            }
        } catch (err: any) {
            console.error('Error creating PIN');
            setError(err.message || 'Failed to create PIN');
        } finally {
            setCreatingPin(false);
        }
    };

    const handleConfirmDonation = async () => {
        if (!confirmModal.request || !user) return;

        try {
            // Use user's existing PIN
            const pin = user.donor_pin;
            if (!pin) {
                setError("Donor PIN not found. Please refresh and try again.");
                return;
            }

            const { error: donationError } = await supabase
                .from('donations')
                .insert({
                    request_id: confirmModal.request.id,
                    donor_id: user.id,
                    status: 'pending',
                    otp: pin // Storing PIN in the 'otp' column for now as per plan
                });

            if (donationError) throw donationError;

            // Close confirm modal and open Success modal
            setConfirmModal({ isOpen: false, request: null });
            setOtpModal({ isOpen: true, pin, hospitalName: confirmModal.request.hospital_name });
        } catch (err: any) {
            console.error('Donation error');
            setError(err.message || 'Failed to process donation request');
            setConfirmModal({ isOpen: false, request: null });
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-900">Blood Requests</h1>
                <div className="flex gap-4">
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-md ${viewMode === 'list' ? 'bg-white shadow-sm text-primary-600' : 'text-gray-500'}`}
                        >
                            <List className="h-5 w-5" />
                        </button>
                        <button
                            onClick={() => setViewMode('map')}
                            className={`p-2 rounded-md ${viewMode === 'map' ? 'bg-white shadow-sm text-primary-600' : 'text-gray-500'}`}
                        >
                            <MapPin className="h-5 w-5" />
                        </button>
                    </div>
                    {user && (
                        <Link href="/requests/new">
                            <Button variant="primary">
                                Create Request
                            </Button>
                        </Link>
                    )}
                </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
                <Select
                    label="Blood Group"
                    value={filters.bloodGroup}
                    onChange={(e) => {
                        setFilters(prev => ({ ...prev, bloodGroup: e.target.value }));
                        fetchRequests();
                    }}
                    options={[
                        { value: 'all', label: 'All Blood Groups' },
                        { value: 'A+', label: 'A+' },
                        { value: 'A-', label: 'A-' },
                        { value: 'B+', label: 'B+' },
                        { value: 'B-', label: 'B-' },
                        { value: 'AB+', label: 'AB+' },
                        { value: 'AB-', label: 'AB-' },
                        { value: 'O+', label: 'O+' },
                        { value: 'O-', label: 'O-' },
                    ]}
                />
                <Select
                    label="Urgency"
                    value={filters.urgency}
                    onChange={(e) => {
                        setFilters(prev => ({ ...prev, urgency: e.target.value }));
                        fetchRequests();
                    }}
                    options={[
                        { value: 'all', label: 'All Urgency Levels' },
                        { value: 'High', label: 'High' },
                        { value: 'Medium', label: 'Medium' },
                        { value: 'Low', label: 'Low' },
                    ]}
                />
                <Input
                    label="Location"
                    placeholder="Enter city or zip code"
                    value={filters.location}
                    onChange={(e) => setFilters(prev => ({ ...prev, location: e.target.value }))}
                />
            </div>

            {error && (
                <Alert variant="error" onClose={() => setError('')}>
                    {error}
                </Alert>
            )}

            {loading ? (
                <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading requests...</p>
                </div>
            ) : requests.length === 0 ? (
                <div className="text-center py-8">
                    <p className="text-gray-600">No blood requests found</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {viewMode === 'list' ? (
                        requests.map(request => (
                            <BloodRequestCard
                                key={request.id}
                                request={request}
                                onRespond={() => handleDonateClick(request)}
                            />
                        ))
                    ) : (
                        <div className="h-[600px] rounded-xl overflow-hidden border border-gray-200">
                            <Map
                                center={{ lat: 20.5937, lng: 78.9629 }}
                                zoom={5}
                                markers={requests.map(req => ({
                                    position: {
                                        lat: req.location.latitude,
                                        lng: req.location.longitude
                                    },
                                    title: `${req.blood_group} Blood Needed`,
                                    description: `${req.hospital_name} - ${req.units_needed} Unit(s)`
                                }))}
                            />
                        </div>
                    )}
                </div>
            )}

            {/* Create PIN Modal */}
            <Modal
                isOpen={createPinModal.isOpen}
                onClose={() => setCreatePinModal({ isOpen: false, request: null })}
                title="Create Donor PIN"
            >
                <div className="space-y-4">
                    <p className="text-gray-600">
                        To ensure security, please create a <strong>4-digit PIN</strong>. You will use this PIN for all future donations to verify your identity.
                    </p>

                    <div className="bg-yellow-50 p-3 rounded-md text-yellow-800 text-sm">
                        This PIN is permanent. Please choose one you will remember.
                    </div>

                    <Input
                        label="Enter 4-digit PIN"
                        placeholder="e.g. 1234"
                        value={newPin}
                        onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                            setNewPin(val);
                        }}
                        maxLength={4}
                        className="text-center text-2xl tracking-widest"
                    />

                    <div className="pt-2">
                        <Button
                            className="w-full"
                            onClick={handleCreatePin}
                            disabled={newPin.length !== 4 || creatingPin}
                            isLoading={creatingPin}
                        >
                            Save PIN & Continue
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Confirmation Details Modal */}
            <Modal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal({ isOpen: false, request: null })}
                title="Confirm Donation Details"
            >
                <div className="space-y-4">
                    <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                        <div>
                            <p className="text-sm text-gray-500">Hospital</p>
                            <p className="font-medium">{confirmModal.request?.hospital_name}</p>
                            <p className="text-sm text-gray-600">{confirmModal.request?.hospital_address}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm text-gray-500">Blood Group</p>
                                <p className="font-bold text-lg text-primary-600">{confirmModal.request?.blood_group}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Units Needed</p>
                                <p className="font-medium">{confirmModal.request?.units_needed} Unit(s)</p>
                            </div>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Contact Person</p>
                            <p className="font-medium">{confirmModal.request?.contact_name}</p>
                            <p className="text-sm text-primary-600 font-medium">{confirmModal.request?.contact_phone}</p>
                        </div>
                        {confirmModal.request?.notes && (
                            <div>
                                <p className="text-sm text-gray-500">Notes</p>
                                <p className="text-sm italic text-gray-700">{confirmModal.request?.notes}</p>
                            </div>
                        )}
                    </div>

                    <p className="text-sm text-gray-600">
                        By connecting, you agree to visit the hospital and donate blood for this request.
                    </p>

                    <div className="flex gap-3 pt-2">
                        <Button
                            variant="secondary"
                            className="flex-1"
                            onClick={() => setConfirmModal({ isOpen: false, request: null })}
                        >
                            Cancel
                        </Button>
                        <Button
                            className="flex-1"
                            onClick={handleConfirmDonation}
                        >
                            Confirm & Donate
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* PIN Success Modal */}
            <Modal
                isOpen={otpModal.isOpen}
                onClose={() => setOtpModal({ ...otpModal, isOpen: false })}
                title="Donation Initiated"
            >
                <div className="space-y-4">
                    <p>Thank you for offering to donate at <strong>{otpModal.hospitalName}</strong>!</p>

                    <div className="bg-primary-50 p-4 rounded-lg text-center">
                        <p className="text-sm text-primary-700 mb-1">Your Verification PIN</p>
                        <p className="text-3xl font-bold text-primary-600 tracking-wider">
                            {otpModal.pin}
                        </p>
                    </div>

                    <div className="text-sm text-gray-600">
                        <p className="mb-2"><strong>Next Steps:</strong></p>
                        <ol className="list-decimal list-inside space-y-1">
                            <li>Visit the hospital location.</li>
                            <li>Meet the requestor or patient attendant.</li>
                            <li>Share this <strong>Donor PIN</strong> with them to verify your donation.</li>
                        </ol>
                    </div>

                    <div className="pt-2">
                        <Button
                            className="w-full"
                            onClick={() => setOtpModal({ ...otpModal, isOpen: false })}
                        >
                            Close
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
