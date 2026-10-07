"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { HeartPulse, Phone } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/context/AuthContext';
import { useRequests } from '@/context/RequestsContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { calculateEligibility, describePoints, fetchUserStats, type UserStats } from '@/lib/stats';
import { formatBloodGroup } from '@/lib/blood-compatibility';
import { toast } from 'sonner';
import { cn } from '@/lib/cn';

interface DonationWithRequest {
    id: string;
    created_at: string;
    status: string;
    request: {
        id: string;
        hospital_name: string;
        hospital_address?: string;
        blood_group?: string;
        contact_name?: string;
        contact_phone?: string;
        status?: string;
    } | null;
}

type Filter = 'all' | 'pending' | 'verified' | 'closed';

const getDisplayStatus = (donation: DonationWithRequest) => {
    if (donation.status === 'completed') return { label: 'Verified', variant: 'success' as const, key: 'verified' as const };
    if (donation.status === 'cancelled') return { label: 'Withdrawn', variant: 'neutral' as const, key: 'closed' as const };
    if (donation.request?.status && donation.request.status !== 'active') {
        return { label: 'Request closed', variant: 'neutral' as const, key: 'closed' as const };
    }
    return { label: 'Offered', variant: 'warning' as const, key: 'pending' as const };
};

export default function DonationsPage() {
    const { user } = useAuth();
    const { refreshRequests } = useRequests();
    const [donations, setDonations] = useState<DonationWithRequest[]>([]);
    const [stats, setStats] = useState<UserStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [donationToWithdraw, setDonationToWithdraw] = useState<string | null>(null);
    const [isWithdrawing, setIsWithdrawing] = useState(false);
    const [filter, setFilter] = useState<Filter>('all');

    useEffect(() => {
        if (!user) return;

        const fetchDonations = async () => {
            try {
                const [{ data, error }, userStats] = await Promise.all([
                    supabase
                        .from('donations')
                        .select(`
                            id,
                            created_at,
                            status,
                            request:blood_requests (
                                id,
                                hospital_name,
                                hospital_address,
                                blood_group,
                                contact_name,
                                status
                            )
                        `)
                        .eq('donor_id', user.id)
                        .order('created_at', { ascending: false }),
                    fetchUserStats(user.id).catch(() => null),
                ]);

                if (error) throw error;

                const rows: DonationWithRequest[] = (data || []).map((item: any) => ({
                    ...item,
                    request: Array.isArray(item.request) ? item.request[0] : item.request,
                }));

                // Phone numbers aren't on the request row; fetch them for live offers only.
                const live = rows.filter(r => r.status === 'pending' && r.request?.status === 'active' && r.request?.id);
                const contacts = await Promise.all(
                    live.map(r => supabase.rpc('get_request_contact', { p_request_id: r.request!.id }).then(({ data }) => [r.id, data?.[0]] as const))
                );
                const phoneByDonation = new Map(contacts.map(([id, c]) => [id, c?.contact_phone as string | undefined]));

                setDonations(rows.map(r => (
                    phoneByDonation.has(r.id) && r.request
                        ? { ...r, request: { ...r.request, contact_phone: phoneByDonation.get(r.id) } }
                        : r
                )));
                setStats(userStats);
            } catch {
                setError('Couldn’t load your donation history. Please refresh.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchDonations();
    }, [user]);

    const performWithdraw = async () => {
        if (!donationToWithdraw) return;
        setIsWithdrawing(true);
        try {
            const { error } = await supabase.from('donations').update({ status: 'cancelled' }).eq('id', donationToWithdraw);
            if (error) throw error;

            setDonations(prev => prev.map(d => (d.id === donationToWithdraw ? { ...d, status: 'cancelled' } : d)));
            await refreshRequests();
            toast.success('Offer withdrawn');
        } catch {
            toast.error('Couldn’t withdraw the offer. Please try again.');
        } finally {
            setIsWithdrawing(false);
            setDonationToWithdraw(null);
        }
    };

    const eligibility = calculateEligibility(stats?.last_donation_date || null);
    const counts = donations.reduce<Record<Filter, number>>(
        (acc, d) => { acc.all++; acc[getDisplayStatus(d).key]++; return acc; },
        { all: 0, pending: 0, verified: 0, closed: 0 },
    );
    const filtered = donations.filter(d => filter === 'all' || getDisplayStatus(d).key === filter);

    return (
        <div className="space-y-10">
            <header>
                <h1 className="display text-4xl sm:text-[2.75rem]">My donations</h1>
                <p className="mt-3 max-w-lg text-gray-600">
                    Requests you have offered to donate for. Show your PIN at the hospital so they can confirm your donation.
                </p>
            </header>

            {error && <Alert variant="error">{error}</Alert>}

            <dl className="grid grid-cols-3 gap-4 border-y border-gray-200 py-6 sm:gap-8">
                {[
                    { label: 'Verified donations', value: isLoading ? null : String(stats?.total_donations ?? counts.verified) },
                    { label: 'Points', value: isLoading ? null : String(stats?.total_points ?? 0) },
                    {
                        label: 'Next eligible',
                        value: isLoading ? null : eligibility.isEligible ? 'Now' : format(eligibility.nextEligibleDate, 'd MMM'),
                    },
                ].map(item => (
                    <div key={item.label}>
                        <dt className="text-sm text-gray-500">{item.label}</dt>
                        <dd className="mt-1.5 text-xl font-medium tabular-nums text-gray-900 sm:text-2xl">
                            {item.value ?? <Skeleton className="h-8 w-14" />}
                        </dd>
                    </div>
                ))}
            </dl>
            {!isLoading && stats?.points && stats.points.total > 0 && (
                <p className="-mt-6 text-sm text-gray-500">{describePoints(stats.points)}</p>
            )}

            <section className="space-y-4">
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter donations">
                    {(['all', 'pending', 'verified', 'closed'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setFilter(tab)}
                            aria-pressed={filter === tab}
                            className={cn(
                                'h-8 rounded-full border px-3 text-[13px] capitalize transition-colors',
                                filter === tab ? 'border-gray-900 bg-gray-900 text-gray-50' : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400',
                            )}
                        >
                            {tab === 'pending' ? 'Offered' : tab} <span className="ml-1 tabular-nums opacity-60">{counts[tab]}</span>
                        </button>
                    ))}
                </div>

                {isLoading ? (
                    <div className="space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}</div>
                ) : filtered.length === 0 ? (
                    <EmptyState
                        icon={HeartPulse}
                        title={filter === 'all' ? 'No offers yet' : 'No donations in this view'}
                        description={filter === 'all' ? 'When you offer to donate for a request, it will appear here with the contact details and your PIN.' : 'Try a different filter.'}
                        actionLabel={filter === 'all' ? 'See open requests' : undefined}
                        onAction={() => { window.location.href = '/requests'; }}
                    />
                ) : (
                    <ul className="divide-y divide-gray-200 overflow-hidden rounded-lg border border-gray-200 bg-white">
                        {filtered.map(donation => {
                            const status = getDisplayStatus(donation);
                            const isPending = status.key === 'pending';
                            return (
                                <li key={donation.id} className="p-5">
                                    <div className="flex items-start gap-4">
                                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-gray-100 font-serif text-2xl tracking-tight text-gray-900">
                                            {formatBloodGroup(donation.request?.blood_group)}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                {donation.request?.id ? (
                                                    <Link href={`/requests/${donation.request.id}`} className="font-medium text-gray-900 hover:underline hover:underline-offset-4">
                                                        {donation.request.hospital_name}
                                                    </Link>
                                                ) : (
                                                    <span className="font-medium text-gray-900">Request removed</span>
                                                )}
                                                <Badge variant={status.variant} size="sm">{status.label}</Badge>
                                            </div>
                                            <p className="mt-0.5 text-sm text-gray-500">Offered on {format(new Date(donation.created_at), 'd MMM yyyy')}</p>

                                            {isPending && (
                                                <div className="mt-4 flex flex-col gap-4 rounded-md bg-gray-100/70 p-4 sm:flex-row sm:items-center sm:justify-between">
                                                    <div className="text-sm">
                                                        <p className="text-gray-500">Contact</p>
                                                        <p className="mt-0.5 text-gray-900">{donation.request?.contact_name}</p>
                                                        {donation.request?.contact_phone && (
                                                            <a href={`tel:${donation.request.contact_phone}`} className="mt-1 inline-flex items-center gap-1.5 font-medium text-red-700 hover:text-red-800">
                                                                <Phone className="h-3.5 w-3.5" /> {donation.request.contact_phone}
                                                            </a>
                                                        )}
                                                    </div>
                                                    {user?.donor_pin && (
                                                        <div className="sm:text-right">
                                                            <p className="text-sm text-gray-500">Your PIN</p>
                                                            <p className="mt-0.5 font-mono text-2xl tracking-[0.3em] text-gray-900">{user.donor_pin}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        {isPending && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="shrink-0 text-gray-500"
                                                onClick={() => setDonationToWithdraw(donation.id)}
                                            >
                                                Withdraw
                                            </Button>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>

            <ConfirmationModal
                isOpen={!!donationToWithdraw}
                onClose={() => setDonationToWithdraw(null)}
                onConfirm={performWithdraw}
                title="Withdraw this offer?"
                description="The requester will no longer see you as an incoming donor. If you have already been in touch, please let them know."
                confirmText="Withdraw offer"
                variant="danger"
                isLoading={isWithdrawing}
            />
        </div>
    );
}
