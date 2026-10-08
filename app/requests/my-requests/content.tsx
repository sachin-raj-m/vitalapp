"use client";

import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Check, FileText, Phone, Plus } from 'lucide-react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatBloodGroup } from '@/lib/blood-compatibility';
import { cn } from '@/lib/cn';
import type { BloodRequest, Donation } from '@/types';
import { toast } from 'sonner';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { EmptyState } from '@/components/EmptyState';
import { logActivity } from '@/lib/logger';
import { isRequestOpen } from '@/lib/requests';

interface RequestWithDonations extends BloodRequest {
    donations: (Donation & { profiles: { full_name: string; phone: string | null } | null, units_donated: number | null })[];
}

type Tab = 'active' | 'past';

// The tab lives in the URL (?tab=past), not only in component state.
// ProtectedRoute swaps this page for a loader whenever the auth profile
// refetches (Supabase fires SIGNED_IN on every hidden -> visible tab switch),
// which unmounts the page; plain useState would snap back to 'active'.
const readTabFromUrl = (): Tab => {
    if (typeof window === 'undefined') return 'active';
    try {
        return new URLSearchParams(window.location.search).get('tab') === 'past' ? 'past' : 'active';
    } catch {
        return 'active';
    }
};

const writeTabToUrl = (tab: Tab) => {
    try {
        const url = new URL(window.location.href);
        if (tab === 'past') url.searchParams.set('tab', 'past');
        else url.searchParams.delete('tab');
        window.history.replaceState(window.history.state, '', url);
    } catch { /* ignore */ }
};

// Never let one malformed date take the whole list down.
const formatDay = (value: string | null | undefined, parse: (v: string) => Date = (v) => new Date(v)) => {
    if (!value) return null;
    try {
        const date = parse(value);
        return Number.isNaN(date.getTime()) ? null : format(date, 'd MMM');
    } catch {
        return null;
    }
};

// Per-card boundary: a render error in one request card shows a fallback for
// that card only, instead of unmounting the page (and freezing the tabs).
class RequestCardBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
    state = { failed: false };
    static getDerivedStateFromError() {
        return { failed: true };
    }
    componentDidCatch(error: unknown) {
        console.error('Error rendering request card', error);
    }
    render() {
        if (this.state.failed) {
            return (
                <div className="rounded-lg border border-gray-200 bg-white p-5 text-sm text-gray-500">
                    This request couldn’t be displayed. Please refresh the page.
                </div>
            );
        }
        return this.props.children;
    }
}

export function MyRequestsContent() {
    const { user } = useAuth();
    const [requests, setRequests] = useState<RequestWithDonations[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTabState] = useState<Tab>(readTabFromUrl);
    const setActiveTab = (tab: Tab) => {
        setActiveTabState(tab);
        writeTabToUrl(tab);
    };

    // New state for delete operation
    const [requestToDelete, setRequestToDelete] = useState<string | null>(null);

    const filteredRequests = requests.filter(req => {
        // Past its needed-by date counts as no longer open, even if not closed.
        if (activeTab === 'active') return isRequestOpen(req);
        // Same rule as the tab count: anything that is no longer open.
        return !isRequestOpen(req);
    });

    // Verification State
    const [verifyModal, setVerifyModal] = useState({ isOpen: false, donationId: '', requestId: '', donorName: '', maxUnits: 0 });
    const [otpInput, setOtpInput] = useState('');
    const [unitsDonatedInput, setUnitsDonatedInput] = useState(1);
    const [verifying, setVerifying] = useState(false);
    const [verifyError, setVerifyError] = useState('');

    // Keyed on the id: a profile refetch gives a new `user` object but the
    // same person, and must not reload the list.
    useEffect(() => {
        loadRequests();
    }, [user?.id]);

    const loadRequests = async () => {
        if (!user) return;
        setIsLoading(true);
        setError('');
        try {
            const [{ data, error }, { data: donors, error: donorsError }] = await Promise.all([
                supabase
                    .from('blood_requests')
                    .select('*, donations:donations(id, request_id, donor_id, status, units_donated, created_at)')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false }),
                // Donor names/phones come from an RPC that only returns donors
                // who offered on the caller's own requests.
                supabase.rpc('get_my_request_donors'),
            ]);

            if (error) throw error;
            if (donorsError) throw donorsError;

            const byDonation = new Map<string, { full_name: string; phone: string }>(
                (donors || []).map((d: any) => [d.donation_id, { full_name: d.full_name, phone: d.phone }])
            );
            setRequests((data || []).map((r: any) => ({
                ...r,
                units_needed: Number(r.units_needed) || 0,
                donations: (Array.isArray(r.donations) ? r.donations : []).map((d: any) => ({ ...d, profiles: byDonation.get(d.id) ?? null })),
            })));
        } catch (err: any) {
            console.error('Error fetching requests', err);
            setError('Couldn’t load your requests. Please refresh.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!requestToDelete || !user) return;

        try {
            const { error } = await supabase
                .from('blood_requests')
                .delete()
                .eq('id', requestToDelete);

            if (error) throw error;

            await logActivity({
                userId: user.id,
                action: 'DELETE_REQUEST',
                entityType: 'blood_requests',
                entityId: requestToDelete,
                metadata: { timestamp: new Date().toISOString() }
            });

            setRequests(requests.filter(r => r.id !== requestToDelete));
            toast.success('Request deleted');
        } catch (err) {
            console.error('Delete error', err);
            toast.error('Couldn’t delete the request. Please try again.');
        } finally {
            setRequestToDelete(null);
        }
    };

    const handleVerify = async () => {
        setVerifying(true);
        setVerifyError('');

        try {
            // The PIN is checked on the server; the requester never sees it.
            const { data: result, error: verifyErr } = await supabase.rpc('verify_donation', {
                p_donation_id: verifyModal.donationId,
                p_pin: otpInput,
                p_units: unitsDonatedInput,
            });

            if (verifyErr) {
                setVerifyError(verifyErr.message);
                return;
            }

            // A wrong PIN is returned (not raised) so the server can count attempts.
            if (result?.error === 'pin_mismatch') {
                const left = Number(result.attempts_left ?? 0);
                setVerifyError(
                    left > 0
                        ? `That PIN doesn’t match. Ask the donor to check it. ${left} ${left === 1 ? 'attempt' : 'attempts'} left.`
                        : 'That PIN doesn’t match, and this offer is now locked. Ask the donor to withdraw and offer again.'
                );
                return;
            }

            if (user) {
                await logActivity({
                    userId: user.id,
                    action: result?.fulfilled ? 'FULFILL_REQUEST' : 'VERIFY_DONATION',
                    entityType: 'donations',
                    entityId: verifyModal.donationId,
                    metadata: { requestId: verifyModal.requestId, unitsDonated: unitsDonatedInput },
                });
            }

            await loadRequests();
            setVerifyModal({ isOpen: false, donationId: '', requestId: '', donorName: '', maxUnits: 0 });
            setOtpInput('');
            setUnitsDonatedInput(1);
            toast.success(
                result?.fulfilled
                    ? 'Donation confirmed. Your request is fulfilled and now closed.'
                    : `Donation confirmed. ${result?.total_collected ?? ''} of ${result?.units_needed ?? ''} units collected.`
            );
        } catch (err: any) {
            console.error('Verification error', err);
            setVerifyError(err.message || 'Verification failed');
        } finally {
            setVerifying(false);
        }
    };

    const counts = {
        active: requests.filter(r => isRequestOpen(r)).length,
        past: requests.filter(r => !isRequestOpen(r)).length,
    };

    return (
        <div className="space-y-10">
            <header className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
                <div>
                    <h1 className="display text-4xl sm:text-[2.75rem]">My requests</h1>
                    <p className="mt-3 max-w-lg text-gray-600">
                        Track offers from donors and confirm each donation with the donor’s PIN.
                    </p>
                </div>
                <Link
                    href="/requests/new"
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 self-start rounded-md bg-red-600 px-3.5 text-sm font-medium text-white transition-colors hover:bg-red-700 sm:self-auto"
                >
                    <Plus className="h-4 w-4" /> New request
                </Link>
            </header>

            {error && <Alert variant="error">{error}</Alert>}

            <div className="flex gap-1.5" role="tablist">
                {(['active', 'past'] as const).map(tab => (
                    <button
                        key={tab}
                        type="button"
                        role="tab"
                        aria-selected={activeTab === tab}
                        onClick={() => setActiveTab(tab)}
                        className={cn(
                            'h-8 rounded-full border px-3 text-[13px] capitalize transition-colors',
                            activeTab === tab ? 'border-gray-900 bg-gray-900 text-gray-50' : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400',
                        )}
                    >
                        {tab} <span className="ml-1 tabular-nums opacity-60">{isLoading ? '·' : counts[tab]}</span>
                    </button>
                ))}
            </div>

            {isLoading ? (
                <div className="space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-48 w-full rounded-lg" />)}</div>
            ) : filteredRequests.length === 0 ? (
                <EmptyState
                    icon={FileText}
                    title={activeTab === 'active' ? 'No open requests' : 'No past requests'}
                    description={activeTab === 'active'
                        ? 'When you post a request, compatible donors nearby are notified.'
                        : 'Fulfilled and closed requests will appear here.'}
                    actionLabel={activeTab === 'active' ? 'Request blood' : undefined}
                    onAction={() => { window.location.href = '/requests/new'; }}
                />
            ) : (
                <div className="space-y-4">
                    {filteredRequests.map((request) => {
                        const donations = request.donations ?? [];
                        const collected = donations
                            .filter(d => d.status === 'completed')
                            .reduce((sum, d) => sum + (Number(d.units_donated) || 0), 0);
                        // Not fulfilled or closed. Offers made before the needed-by date can
                        // still be confirmed after it, so this gates the PIN step, not isOpen.
                        const isActive = request.status === 'active';
                        const isOpen = isRequestOpen(request);
                        const isExpired = isActive && !isOpen;
                        // Same semantics as verify_donation(): NULL units count as 0.
                        const remaining = Math.max(0, request.units_needed - collected);
                        const overCollected = collected > request.units_needed;
                        const progress = Math.min(100, Math.max(0, (collected / Math.max(1, request.units_needed)) * 100));
                        const offers = donations.filter(d => d.status !== 'cancelled');
                        const postedOn = formatDay(request.created_at);
                        const neededBy = formatDay(request.date_needed, parseISO);
                        const fulfilledOn = request.status === 'fulfilled' ? formatDay(request.updated_at) : null;

                        return (
                            <RequestCardBoundary key={request.id}>
                            <article className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                                <div className="flex items-start gap-4 p-5">
                                    <div className={cn(
                                        'flex h-14 w-14 shrink-0 items-center justify-center rounded-md font-serif text-3xl tracking-tight',
                                        isOpen ? 'bg-gray-900 text-gray-50' : 'bg-gray-100 text-gray-500',
                                    )}>
                                        {formatBloodGroup(request.blood_group)}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Link href={`/requests/${request.id}`} className="font-medium text-gray-900 hover:underline hover:underline-offset-4">
                                                {request.hospital_name}
                                            </Link>
                                            <Badge variant={isOpen ? 'warning' : request.status === 'fulfilled' ? 'success' : 'neutral'} size="sm">
                                                {isOpen ? 'Open' : isExpired ? 'Expired' : request.status === 'fulfilled' ? 'Fulfilled' : 'Closed'}
                                            </Badge>
                                        </div>
                                        <p className="mt-0.5 text-sm text-gray-500">
                                            {postedOn ? `Posted ${postedOn}` : 'Posted'}
                                            {neededBy && ` · Needed by ${neededBy}`}
                                            {fulfilledOn && ` · Fulfilled ${fulfilledOn}`}
                                        </p>

                                        <div className="mt-4 max-w-xs">
                                            <div className="flex justify-between text-[13px]">
                                                <span className="text-gray-500">Collected</span>
                                                <span className="tabular-nums text-gray-900">
                                                    {overCollected
                                                        ? `${collected} units recorded (${request.units_needed} requested)`
                                                        : `${collected} of ${request.units_needed} units`}
                                                </span>
                                            </div>
                                            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-gray-200">
                                                <div className="h-full rounded-full bg-success-500" style={{ width: `${progress}%` }} />
                                            </div>
                                        </div>
                                    </div>
                                    {isActive && (
                                        <Button variant="ghost" size="sm" className="shrink-0 text-gray-500" onClick={() => setRequestToDelete(request.id)}>
                                            Delete
                                        </Button>
                                    )}
                                </div>

                                <div className="border-t border-gray-200 bg-gray-50/60 px-5 py-4">
                                    <h3 className="text-sm font-medium text-gray-900">Donor offers <span className="font-normal text-gray-500">({offers.length})</span></h3>
                                    {offers.length > 0 ? (
                                        <ul className="mt-3 divide-y divide-gray-200">
                                            {offers.map(donation => (
                                                <li key={donation.id} className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-700">
                                                            {donation.profiles?.full_name?.charAt(0) || '·'}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-medium text-gray-900">{donation.profiles?.full_name || 'Anonymous donor'}</p>
                                                            {isActive && donation.profiles?.phone ? (
                                                                <a href={`tel:${donation.profiles.phone}`} className="inline-flex items-center gap-1 text-[13px] text-gray-600 hover:text-gray-900">
                                                                    <Phone className="h-3 w-3" /> {donation.profiles.phone}
                                                                </a>
                                                            ) : (
                                                                <p className="text-[13px] text-gray-500">Contact hidden after closing</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {donation.status === 'pending' && isActive && remaining > 0 ? (
                                                        <Button
                                                            size="sm"
                                                            variant="ink"
                                                            onClick={() => {
                                                                setUnitsDonatedInput(1);
                                                                setVerifyModal({
                                                                    isOpen: true,
                                                                    donationId: donation.id,
                                                                    requestId: request.id,
                                                                    donorName: donation.profiles?.full_name ?? "",
                                                                    maxUnits: Math.max(1, remaining),
                                                                });
                                                            }}
                                                        >
                                                            Confirm with PIN
                                                        </Button>
                                                    ) : donation.status === 'completed' ? (
                                                        <span className="inline-flex items-center gap-1 text-[13px] font-medium text-success-700">
                                                            <Check className="h-3.5 w-3.5" /> Donated
                                                        </span>
                                                    ) : null}
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="mt-2 text-sm text-gray-500">
                                            No offers yet. Sharing the request link can help it reach more donors.
                                        </p>
                                    )}
                                </div>
                            </article>
                            </RequestCardBoundary>
                        );
                    })}
                </div>
            )}

            <Modal
                isOpen={verifyModal.isOpen}
                onClose={() => setVerifyModal({ ...verifyModal, isOpen: false })}
                title={`Confirm ${verifyModal.donorName || 'donor'}’s donation`}
            >
                <div className="space-y-5">
                    <p className="leading-relaxed text-gray-600">
                        After the donor has donated, ask for their 4-digit PIN and enter it below.
                    </p>
                    <Input
                        label="Donor PIN"
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="••••"
                        value={otpInput}
                        onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        maxLength={4}
                        className="h-14 text-center font-mono text-2xl tracking-[0.5em]"
                    />
                    <div>
                        <p className="text-[13px] font-medium text-gray-800">Units donated</p>
                        <div className="mt-1.5 inline-flex items-center rounded-md border border-gray-300 bg-white">
                            <button
                                type="button"
                                className="h-10 w-10 text-lg text-gray-600 hover:text-gray-900 disabled:opacity-30"
                                onClick={() => setUnitsDonatedInput(Math.max(1, unitsDonatedInput - 1))}
                                disabled={unitsDonatedInput <= 1}
                                aria-label="Fewer units"
                            >
                                −
                            </button>
                            <span className="w-10 text-center text-lg tabular-nums text-gray-900">{unitsDonatedInput}</span>
                            <button
                                type="button"
                                className="h-10 w-10 text-lg text-gray-600 hover:text-gray-900 disabled:opacity-30"
                                onClick={() => setUnitsDonatedInput(Math.min(verifyModal.maxUnits || 1, unitsDonatedInput + 1))}
                                disabled={unitsDonatedInput >= (verifyModal.maxUnits || 1)}
                                aria-label="More units"
                            >
                                +
                            </button>
                        </div>
                    </div>
                    {verifyError && <p className="text-sm text-red-700">{verifyError}</p>}
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <Button variant="secondary" onClick={() => setVerifyModal({ ...verifyModal, isOpen: false })}>Cancel</Button>
                        <Button variant="ink" onClick={handleVerify} isLoading={verifying} disabled={otpInput.length !== 4}>Confirm donation</Button>
                    </div>
                </div>
            </Modal>

            <ConfirmationModal
                isOpen={!!requestToDelete}
                onClose={() => setRequestToDelete(null)}
                onConfirm={handleDelete}
                title="Delete this request?"
                description="The request will be removed from the feed and donors who offered will no longer see it. This cannot be undone."
                confirmText="Delete request"
                variant="danger"
            />
        </div>
    );
}
