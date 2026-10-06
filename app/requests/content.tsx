"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { BloodRequestCard } from '@/components/BloodRequestCard';
import { MapPin, List, Plus, Inbox } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';

const Map = dynamic(() => import('@/components/Map'), {
    ssr: false,
    loading: () => <div className="h-full w-full animate-pulse bg-gray-100" />
});
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { AuthModal } from '@/components/AuthModal';
import { useRouter } from 'next/navigation';
import { Alert } from '@/components/ui/Alert';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import type { BloodRequest } from '@/types';
import { isBloodCompatible } from '@/lib/blood-compatibility';
import { useRequests } from '@/context/RequestsContext';
import { RequestCardSkeleton } from '@/components/skeletons/RequestCardSkeleton';
import type { BloodGroup } from '@/types';
import { TemporaryDeferralModal } from '@/components/nbtc/TemporaryDeferralModal';
import { DonorReadinessModal } from '@/components/nbtc/DonorReadinessModal';
import { EmptyState } from '@/components/EmptyState';
import { BLOOD_GROUPS, formatBloodGroup } from '@/lib/blood-compatibility';

export default function RequestsPage() {
    const { user, refreshProfile } = useAuth();
    const { requests: allRequests, myDonations, refreshRequests, loading: requestsLoading } = useRequests();

    // Local state for UI
    const [filteredRequests, setFilteredRequests] = useState<BloodRequest[]>([]);
    const [selectedRequest, setSelectedRequest] = useState<BloodRequest | null>(null);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [pendingRequestToDonate, setPendingRequestToDonate] = useState<BloodRequest | null>(null);
    // Removed local offeredRequestIds, using myDonations from context
    const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
    const [error, setError] = useState('');

    const [filters, setFilters] = useState({
        bloodGroup: 'all',
        urgency: 'all',
        locationSearch: ''
    });

    // Determine loading state (only for initial load)
    const loading = requestsLoading;

    // Filter Logic (Client-Side)
    useEffect(() => {
        let result = allRequests;

        if (filters.bloodGroup !== 'all') {
            result = result.filter(r => r.blood_group === filters.bloodGroup);
        }
        if (filters.urgency !== 'all') {
            result = result.filter(r => r.urgency_level === filters.urgency);
        }
        if (filters.locationSearch) {
            const search = filters.locationSearch.toLowerCase();
            result = result.filter(r =>
                (r.city && r.city.toLowerCase().includes(search)) ||
                (r.zipcode && r.zipcode.includes(search)) ||
                (r.hospital_address && r.hospital_address.toLowerCase().includes(search))
            );
        }

        setFilteredRequests(result);
    }, [allRequests, filters]);

    // Removed fetchMyDonations effect as it's now in context

    // Removed fetchMyDonations function

    // Removed old fetchRequests function


    const [otpModal, setOtpModal] = useState({ isOpen: false, pin: '', hospitalName: '' });
    const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; request: BloodRequest | null }>({ isOpen: false, request: null });
    const [deferralModalOpen, setDeferralModalOpen] = useState(false);
    const [readinessModalOpen, setReadinessModalOpen] = useState(false);
    const [createPinModal, setCreatePinModal] = useState<{ isOpen: boolean; request: BloodRequest | null }>({ isOpen: false, request: null });
    const [newPin, setNewPin] = useState('');
    // The request just offered on. Kept separately because confirmModal is
    // cleared before the readiness modal, which still needs it to show the PIN.
    const [offeredRequest, setOfferedRequest] = useState<BloodRequest | null>(null);
    const [creatingPin, setCreatingPin] = useState(false);

    // Removed redundant refreshProfile declaration

    const handleDonateClick = (request: BloodRequest) => {
        if (!user) {
            setPendingRequestToDonate(request);
            setShowAuthModal(true);
            return;
        }

        if (!user.blood_group) {
            setError('Please update your profile with your Blood Group to donate.');
            return;
        }

        // Check Blood Compatibility
        if (!isBloodCompatible(user.blood_group, request.blood_group)) {
            setError(`Medical Safety: Your blood group (${user.blood_group}) is not compatible with the patient (${request.blood_group}).`);
            return;
        }

        // NBTC Safety Check: Open Deferral Modal First
        setSelectedRequest(request);
        setDeferralModalOpen(true);
    };

    // Deep link from a shared request page: /requests?offer=<id> starts the
    // donate flow for that request once the feed has loaded.
    const [pendingOfferId, setPendingOfferId] = useState<string | null>(null);
    useEffect(() => {
        const id = new URLSearchParams(window.location.search).get('offer');
        if (id) setPendingOfferId(id);
    }, []);
    useEffect(() => {
        if (!pendingOfferId || loading) return;
        const target = allRequests.find(r => r.id === pendingOfferId);
        setPendingOfferId(null);
        window.history.replaceState(null, '', '/requests');
        if (target) handleDonateClick(target);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pendingOfferId, loading, allRequests]);

    const handleDeferralPassed = () => {
        setDeferralModalOpen(false);
        const request = selectedRequest;
        if (!request || !user) return;

        // Check if user has a PIN
        if (!user.donor_pin) {
            setCreatePinModal({ isOpen: true, request });
        } else {
            setConfirmModal({ isOpen: true, request });
        }
    };

    const handlePendingClick = (request: BloodRequest) => {
        // Re-open the PIN/Success modal for this request
        if (!user || !user.donor_pin) return;
        setOtpModal({
            isOpen: true,
            pin: user.donor_pin,
            hospitalName: request.hospital_name
        });
    };

    const handleCreatePin = async () => {
        if (!user || newPin.length !== 4) return;
        setCreatingPin(true);
        try {
            const { error: updateError } = await supabase
                .from('donor_secrets')
                .upsert({ user_id: user.id, pin: newPin, updated_at: new Date().toISOString() });

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
            if (!user.donor_pin) {
                setError('Your donor PIN wasn’t found. Please refresh and try again.');
                return;
            }

            // The PIN is never sent with the offer; the requester confirms it
            // server-side via verify_donation().
            const { error: donationError } = await supabase
                .from('donations')
                .insert({
                    request_id: confirmModal.request.id,
                    donor_id: user.id,
                    status: 'pending'
                });

            if (donationError) throw donationError;

            setOfferedRequest(confirmModal.request);
            setConfirmModal({ isOpen: false, request: null });

            // Trigger global refresh to update "Offer Sent" and Analytics
            await refreshRequests();

            // NBTC: Show Readiness Modal before PIN
            setReadinessModalOpen(true);
            // setOtpModal({ isOpen: true, pin, hospitalName: confirmModal.request.hospital_name });
        } catch (err: any) {
            console.error('Donation error');
            setError(err.message || 'Failed to process donation request');
            setConfirmModal({ isOpen: false, request: null });
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
                <div>
                    <p className="eyebrow">Open requests</p>
                    <h1 className="display mt-3 text-5xl leading-none">
                        {loading ? 'Requests' : <>{filteredRequests.length} {filteredRequests.length === 1 ? 'person needs' : 'people need'} <em className="text-red-600">blood.</em></>}
                    </h1>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex rounded-md border border-gray-300 bg-white p-0.5" role="tablist" aria-label="View">
                        {([['list', List, 'List'], ['map', MapPin, 'Map']] as const).map(([mode, Icon, label]) => (
                            <button
                                key={mode}
                                role="tab"
                                aria-selected={viewMode === mode}
                                onClick={() => setViewMode(mode)}
                                className={`flex h-8 items-center gap-1.5 rounded-[5px] px-3 text-[13px] transition-colors ${viewMode === mode ? 'bg-gray-900 text-gray-50' : 'text-gray-600 hover:text-gray-900'}`}
                            >
                                <Icon className="h-3.5 w-3.5" /> {label}
                            </button>
                        ))}
                    </div>
                    {(
                        <Link
                            href="/requests/new"
                            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-red-600 px-3.5 text-sm font-medium text-white transition-colors hover:bg-red-700"
                        >
                            <Plus className="h-4 w-4" /> New request
                        </Link>
                    )}
                </div>
            </div>

            <div className="space-y-4 border-y border-gray-200 py-4">
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by blood group">
                    {(['all', ...BLOOD_GROUPS] as const).map(group => {
                        const active = filters.bloodGroup === group;
                        return (
                            <button
                                key={group}
                                onClick={() => setFilters(prev => ({ ...prev, bloodGroup: group }))}
                                aria-pressed={active}
                                className={`h-8 min-w-[2.75rem] rounded-full border px-3 text-[13px] transition-colors ${active ? 'border-gray-900 bg-gray-900 text-gray-50' : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'}`}
                            >
                                {group === 'all' ? 'All groups' : formatBloodGroup(group)}
                            </button>
                        );
                    })}
                </div>
                <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
                    <Input
                        aria-label="Search by city, PIN code or hospital"
                        placeholder="Search city, PIN code or hospital"
                        value={filters.locationSearch}
                        onChange={(e) => setFilters(prev => ({ ...prev, locationSearch: e.target.value }))}
                    />
                    <Select
                        aria-label="Urgency"
                        value={filters.urgency}
                        onChange={(e) => setFilters(prev => ({ ...prev, urgency: e.target.value }))}
                        options={[
                            { value: 'all', label: 'Any urgency' },
                            { value: 'High', label: 'Urgent' },
                            { value: 'Medium', label: 'Soon' },
                            { value: 'Low', label: 'Planned' },
                        ]}
                    />
                </div>
            </div>

            {error && (
                <Alert variant="error" onClose={() => setError('')}>
                    {error}
                </Alert>
            )}

            {loading ? (
                <div className="space-y-3">{[1, 2, 3].map((i) => <RequestCardSkeleton key={i} />)}</div>
            ) : filteredRequests.length === 0 ? (
                <EmptyState
                    icon={Inbox}
                    title={allRequests.length === 0 ? 'No open requests right now' : 'Nothing matches those filters'}
                    description={allRequests.length === 0
                        ? 'That’s good news. When someone needs blood, it will show up here.'
                        : 'Try another blood group or clear the search.'}
                    actionLabel={allRequests.length === 0 ? undefined : 'Clear filters'}
                    onAction={() => setFilters({ bloodGroup: 'all', urgency: 'all', locationSearch: '' })}
                />
            ) : viewMode === 'list' ? (
                <div className="space-y-3">
                    {filteredRequests.map(request => (
                        <BloodRequestCard
                            key={request.id}
                            request={request}
                            onRespond={user?.id === request.user_id ? undefined : () => handleDonateClick(request)}
                            onPendingClick={() => handlePendingClick(request)}
                            userBloodGroup={user?.blood_group}
                            hasOffered={myDonations.has(request.id)}
                            isOwnRequest={user?.id === request.user_id}
                        />
                    ))}
                </div>
            ) : (
                <div className="relative z-0 h-[560px] overflow-hidden rounded-lg border border-gray-200">
                    <Map
                        center={{ lat: 20.5937, lng: 78.9629 }}
                        zoom={5}
                        markers={filteredRequests
                            .filter(req => req.location?.latitude && req.location?.longitude)
                            .map(req => ({
                                position: { lat: req.location.latitude, lng: req.location.longitude },
                                title: `${formatBloodGroup(req.blood_group)} needed`,
                                description: `${req.hospital_name} · ${req.units_needed} unit(s)`
                            }))}
                    />
                </div>
            )}

            {/* Create PIN Modal */}
            <Modal
                isOpen={createPinModal.isOpen}
                onClose={() => setCreatePinModal({ isOpen: false, request: null })}
                title="Create Donor PIN"
            >
                <div className="space-y-4">
                    <p className="leading-relaxed text-gray-600">
                        The family enters this PIN at the hospital to confirm you donated. You’ll use the same PIN every time,
                        so pick one you’ll remember.
                    </p>

                    <Input
                        label="4-digit PIN"
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="••••"
                        value={newPin}
                        onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                            setNewPin(val);
                        }}
                        maxLength={4}
                        className="h-14 text-center font-mono text-2xl tracking-[0.5em]"
                    />

                    <div className="pt-2">
                        <Button
                            variant="ink"
                            size="lg"
                            className="w-full"
                            onClick={handleCreatePin}
                            disabled={newPin.length !== 4 || creatingPin}
                            isLoading={creatingPin}
                        >
                            Save PIN and continue
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Confirmation Details Modal */}
            <Modal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal({ isOpen: false, request: null })}
                title="Confirm your offer"
            >
                <div className="space-y-5">
                    <dl className="divide-y divide-gray-200 border-y border-gray-200">
                        {[
                            ['Blood group', formatBloodGroup(confirmModal.request?.blood_group)],
                            ['Units', `${confirmModal.request?.units_needed ?? ''}`],
                            ['Hospital', [confirmModal.request?.hospital_name, confirmModal.request?.hospital_address].filter(Boolean).join(', ')],
                            ['Contact', `${confirmModal.request?.contact_name ?? ''} · number shown once you offer`],
                            ...(confirmModal.request?.notes ? [['Notes', confirmModal.request.notes]] : []),
                        ].map(([k, v]) => (
                            <div key={k} className="grid grid-cols-3 gap-4 py-3">
                                <dt className="text-gray-500">{k}</dt>
                                <dd className="col-span-2 text-gray-900">{v}</dd>
                            </div>
                        ))}
                    </dl>

                    <p className="leading-relaxed text-gray-600">
                        By offering, you’re telling this family you’ll go to the hospital and donate. Their number
                        appears in My donations as soon as you offer. Please call them first.
                    </p>

                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <Button variant="secondary" onClick={() => setConfirmModal({ isOpen: false, request: null })}>
                            Not now
                        </Button>
                        <Button onClick={handleConfirmDonation}>
                            I’ll donate
                        </Button>
                    </div>
                </div>
            </Modal>



            <AuthModal
                isOpen={showAuthModal}
                onClose={() => {
                    setShowAuthModal(false);
                    setPendingRequestToDonate(null);
                }}
                onSuccess={() => {
                    setShowAuthModal(false);
                    if (pendingRequestToDonate) {
                        // User logged in. Allow them to retry the donation action manually 
                        // by clicking "I can donate" again, which is now cleaner UX than auto-triggering.
                    }
                }}
                message="Sign in to offer your blood"
            />

            {/* PIN Success Modal */}
            <Modal
                isOpen={otpModal.isOpen}
                onClose={() => setOtpModal({ ...otpModal, isOpen: false })}
                title="Your donor PIN"
            >
                <div className="space-y-6">
                    <div className="rounded-lg bg-gray-950 px-6 py-8 text-center">
                        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-gray-500">Show this at {otpModal.hospitalName}</p>
                        <p className="mt-3 font-mono text-5xl tracking-[0.3em] text-white">{otpModal.pin}</p>
                    </div>

                    <ol className="space-y-3">
                        {[
                            'Call the family. Their number is in My donations.',
                            'Go to the hospital and donate.',
                            'Tell them this PIN so they can confirm it in Vital.',
                        ].map((step, i) => (
                            <li key={step} className="flex gap-3">
                                <span className="font-mono text-xs leading-6 text-red-600">0{i + 1}</span>
                                <span className="leading-6 text-gray-700">{step}</span>
                            </li>
                        ))}
                    </ol>

                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <Button variant="secondary" onClick={() => setOtpModal({ ...otpModal, isOpen: false })}>
                            Close
                        </Button>
                        <Link
                            href="/donations"
                            className="inline-flex h-10 items-center justify-center rounded-md bg-gray-900 px-4 text-sm font-medium text-gray-50 hover:bg-gray-800"
                        >
                            Go to My donations
                        </Link>
                    </div>
                </div>
            </Modal>
            {/* NBTC Safety Modals */}
            <TemporaryDeferralModal
                isOpen={deferralModalOpen}
                onClose={() => setDeferralModalOpen(false)}
                onConfirm={handleDeferralPassed}
            />

            <DonorReadinessModal
                isOpen={readinessModalOpen}
                onClose={() => {
                    setReadinessModalOpen(false);
                    if (user?.donor_pin && offeredRequest) {
                        setOtpModal({
                            isOpen: true,
                            pin: user.donor_pin,
                            hospitalName: offeredRequest.hospital_name
                        });
                    }
                    setOfferedRequest(null);
                }}
            />
        </div>
    );
}
