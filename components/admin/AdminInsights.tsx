"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AlertTriangle, Clock, MapPinOff, MessageSquareWarning, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';

/** Shape of public.admin_insights() (migration 20261017000400). */
type Labelled = { label: string };
type RequestBreakdown = Labelled & { total: number; open: number; fulfilled: number };
type AttentionRequest = {
    id: string; blood_group: string; units_needed: number; hospital_name: string; city: string | null;
    urgency_level: string | null; date_needed: string | null; created_at: string; offers?: number;
};
type WhatsAppWindow = { total: number; failed: number; by_kind: Record<string, number>; by_status: Record<string, number> };

export interface Insights {
    generated_at: string;
    days: number;
    people: {
        accounts: number; donors: number; available_donors: number; signups_7d: number; signups_30d: number;
        donors_7d: number; donors_without_location: number; donors_without_blood_group: number;
        consent_recorded: number; consent_missing: number; email_confirmed: number; email_unconfirmed: number;
        no_email: number; phone_verified: number; phone_unverified: number; no_phone: number;
        whatsapp_opted_in: number; whatsapp_opted_in_donors: number;
        donors_by_blood_group: (Labelled & { count: number; available: number })[];
        top_cities: (Labelled & { donors: number; accounts: number })[];
    };
    requests: {
        total: number; open: number; expired_active: number; fulfilled: number; cancelled: number; other: number;
        last_7d: number; last_30d: number; units_requested: number; units_requested_open: number; units_collected: number;
        fulfilment_rate: number | null; requests_with_offers: number;
        median_hours_to_first_offer: number | null; median_hours_to_fulfilment: number | null;
        by_blood_group: RequestBreakdown[]; by_urgency: RequestBreakdown[]; by_city: RequestBreakdown[];
    };
    offers: {
        total: number; pending: number; completed: number; cancelled: number; units_donated: number;
        last_7d: number; last_30d: number; from_web: number; from_whatsapp: number;
        completion_rate: number | null; offers_per_request: number | null;
    };
    whatsapp: { last_7d: WhatsAppWindow; last_30d: WhatsAppWindow; inbound_30d: number };
    referrals: { total: number; last_30d: number; referrers: number; top_referrers: { name: string; count: number }[] };
    trend: { date: string; signups: number; requests: number; donations: number }[];
    attention: {
        expired_active: AttentionRequest[];
        no_offers_24h: AttentionRequest[];
        no_offers_24h_count: number;
        whatsapp_failures: { id: string; kind: string; request_id: string | null; error: string | null; created_at: string }[];
        donors_without_location: number;
        pending_offers_7d: number;
    };
}

const BLOOD_ORDER = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const byBloodGroup = (a: Labelled, b: Labelled) => {
    const ia = BLOOD_ORDER.indexOf(a.label), ib = BLOOD_ORDER.indexOf(b.label);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
};

const BRAND = '#dc2626';
const AXIS = '#9ca3af';
const tooltipStyle = { borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: 12 };

const pct = (rate: number | null | undefined) => (rate == null ? '–' : `${Math.round(rate * 100)}%`);
const share = (n: number, total: number) => (total > 0 ? `${Math.round((n / total) * 100)}%` : '–');

function duration(hours: number | null | undefined) {
    if (hours == null) return '–';
    if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
    if (hours < 48) return `${Math.round(hours * 10) / 10} h`;
    return `${Math.round(hours / 24)} days`;
}

const shortDate = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const dateTime = (iso: string) =>
    new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

function Stat({ label, value, detail }: { label: string; value: React.ReactNode; detail?: React.ReactNode }) {
    return (
        // A plain div (not Card) so the dt/dd stay direct children of one div inside the <dl>.
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-[0_1px_2px_rgba(22,24,29,0.04)]">
            <dt className="text-sm text-gray-600">{label}</dt>
            <dd className="mt-1 text-2xl font-bold text-gray-900 tabular-nums">{value}</dd>
            {detail && <dd className="mt-1 text-xs text-gray-600">{detail}</dd>}
        </div>
    );
}

function Section({ title, children, id }: { title: string; children: React.ReactNode; id: string }) {
    return (
        <section aria-labelledby={id} className="space-y-3">
            <h3 id={id} className="text-lg font-semibold text-gray-900">{title}</h3>
            {children}
        </section>
    );
}

/** A labelled share bar: "Consent recorded 3 of 5 (60%)". */
function Meter({ label, value, total }: { label: string; value: number; total: number }) {
    const ratio = total > 0 ? value / total : 0;
    return (
        <div>
            <div className="flex justify-between gap-2 text-sm">
                <span className="text-gray-700">{label}</span>
                <span className="tabular-nums text-gray-900">{value} of {total} <span className="text-gray-600">({share(value, total)})</span></span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-gray-100" role="presentation">
                <div className="h-2 rounded-full bg-red-600" style={{ width: `${Math.round(ratio * 100)}%` }} />
            </div>
        </div>
    );
}

function TrendChart({ title, data, dataKey }: { title: string; data: Insights['trend']; dataKey: 'signups' | 'requests' | 'donations' }) {
    const total = data.reduce((sum, d) => sum + d[dataKey], 0);
    const peak = data.reduce((best, d) => (d[dataKey] > best[dataKey] ? d : best), data[0] ?? { date: '', signups: 0, requests: 0, donations: 0 });
    return (
        <Card>
            <CardHeader className="py-3 sm:py-3">
                <h4 className="font-semibold text-gray-700">{title}</h4>
                <p className="text-xs text-gray-600">{total} in the last {data.length} days</p>
            </CardHeader>
            <div className="h-40 px-2 py-3 sm:px-3" aria-hidden="true">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                        <XAxis dataKey="date" tickFormatter={shortDate} fontSize={11} stroke={AXIS} minTickGap={24} tickLine={false} />
                        <YAxis allowDecimals={false} fontSize={11} stroke={AXIS} tickLine={false} axisLine={false} />
                        <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={tooltipStyle} labelFormatter={(v) => shortDate(String(v))} formatter={(v) => [v, title]} />
                        <Bar dataKey={dataKey} fill={BRAND} radius={[4, 4, 0, 0]} maxBarSize={18} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
            <p className="sr-only">
                {title}: {total} in the last {data.length} days{peak && peak[dataKey] > 0 ? `, busiest day ${shortDate(peak.date)} with ${peak[dataKey]}` : ''}.
            </p>
        </Card>
    );
}

function BreakdownTable({ caption, rows, firstColumn }: { caption: string; rows: RequestBreakdown[]; firstColumn: string }) {
    return (
        <Card>
            <CardBody className="overflow-x-auto p-0 sm:p-0">
                <table className="min-w-full text-sm">
                    <caption className="px-4 pt-3 pb-2 text-left font-semibold text-gray-700">{caption}</caption>
                    <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                        <tr>
                            <th scope="col" className="px-4 py-2 text-left font-medium">{firstColumn}</th>
                            <th scope="col" className="px-4 py-2 text-right font-medium">Total</th>
                            <th scope="col" className="px-4 py-2 text-right font-medium">Open</th>
                            <th scope="col" className="px-4 py-2 text-right font-medium">Fulfilled</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {rows.length === 0 && (
                            <tr><td colSpan={4} className="px-4 py-3 text-gray-600">No requests yet.</td></tr>
                        )}
                        {rows.map(r => (
                            <tr key={r.label}>
                                <th scope="row" className="px-4 py-2 text-left font-medium text-gray-900">{r.label}</th>
                                <td className="px-4 py-2 text-right tabular-nums">{r.total}</td>
                                <td className="px-4 py-2 text-right tabular-nums">{r.open}</td>
                                <td className="px-4 py-2 text-right tabular-nums">{r.fulfilled}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </CardBody>
        </Card>
    );
}

function RequestRow({ r, action }: { r: AttentionRequest; action?: React.ReactNode }) {
    return (
        <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">
                    {r.blood_group} · {r.units_needed} {r.units_needed === 1 ? 'unit' : 'units'} · {r.hospital_name}
                </p>
                <p className="text-xs text-gray-600">
                    {[r.city, r.urgency_level && `${r.urgency_level} urgency`,
                        r.date_needed && `needed by ${shortDate(r.date_needed)}`,
                        `posted ${dateTime(r.created_at)}`,
                        r.offers != null && `${r.offers} live ${r.offers === 1 ? 'offer' : 'offers'}`]
                        .filter(Boolean).join(' · ')}
                </p>
            </div>
            {action}
        </li>
    );
}

export function AdminInsights({ onRequestClosed }: { onRequestClosed?: (requestId: string) => void }) {
    const [data, setData] = useState<Insights | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [closing, setClosing] = useState<AttentionRequest | null>(null);
    const [closeBusy, setCloseBusy] = useState(false);

    const apply = useCallback(({ data: result, error: rpcError }: { data: unknown; error: { message: string } | null }) => {
        if (rpcError) setError(rpcError.message);
        else { setData(result as Insights); setError(''); }
        setLoading(false);
    }, []);

    const load = () => {
        setLoading(true);
        supabase.rpc('admin_insights', { p_days: 30 }).then(apply);
    };

    // Initial load (loading already starts true).
    useEffect(() => {
        supabase.rpc('admin_insights', { p_days: 30 }).then(apply);
    }, [apply]);

    const closeRequest = async () => {
        if (!closing) return;
        setCloseBusy(true);
        const { error: updateError } = await supabase
            .from('blood_requests')
            .update({ status: 'cancelled', updated_at: new Date().toISOString() })
            .eq('id', closing.id);
        setCloseBusy(false);
        if (updateError) {
            toast.error('Could not close the request');
            return;
        }
        toast.success('Request closed');
        onRequestClosed?.(closing.id);
        setClosing(null);
        load();
    };

    if (loading && !data) {
        return (
            <div className="space-y-4" aria-busy="true" aria-label="Loading insights">
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
                </div>
                <Skeleton className="h-48 rounded-xl" />
            </div>
        );
    }

    if (error && !data) {
        return (
            <div className="space-y-3">
                <Alert variant="error">Could not load insights: {error}</Alert>
                <Button variant="outline" size="sm" onClick={load}>Try again</Button>
            </div>
        );
    }

    if (!data) return null;

    const { people, requests, offers, whatsapp, referrals, trend, attention } = data;
    const closedCount = requests.total - requests.open;
    const attentionCount = attention.expired_active.length + attention.no_offers_24h_count
        + attention.whatsapp_failures.length + (attention.donors_without_location > 0 ? 1 : 0);
    const statusOrder = ['sent', 'delivered', 'read', 'failed', 'disabled'];
    const statusKeys = Array.from(new Set([...statusOrder, ...Object.keys(whatsapp.last_30d.by_status)]))
        .filter(s => whatsapp.last_30d.by_status[s] || whatsapp.last_7d.by_status[s]);
    const kindKeys = Object.keys(whatsapp.last_30d.by_kind).sort((a, b) => whatsapp.last_30d.by_kind[b] - whatsapp.last_30d.by_kind[a]);
    const donorGroups = [...people.donors_by_blood_group].sort(byBloodGroup);

    return (
        <div className="space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900">Insights</h2>
                    <p className="text-xs text-gray-600">Updated {dateTime(data.generated_at)}</p>
                </div>
                <Button variant="outline" size="sm" onClick={load} isLoading={loading} className="flex items-center gap-2">
                    <RefreshCw size={16} aria-hidden="true" /> Refresh
                </Button>
            </div>

            {error && <Alert variant="error" onClose={() => setError('')}>{error}</Alert>}

            <Section title="Key numbers" id="insights-key">
                <dl className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                    <Stat label="Available donors" value={people.available_donors}
                        detail={`of ${people.donors} donors (${share(people.available_donors, people.donors)})`} />
                    <Stat label="New sign-ups, 7 days" value={people.signups_7d}
                        detail={`${people.signups_30d} in 30 days · ${people.donors_7d} new donors this week`} />
                    <Stat label="Open requests" value={requests.open}
                        detail={`${requests.units_requested_open} units still needed · ${requests.last_7d} posted this week`} />
                    <Stat label="Fulfilment rate" value={pct(requests.fulfilment_rate)}
                        detail={`${requests.fulfilled} fulfilled of ${closedCount} closed`} />
                    <Stat label="Units collected" value={requests.units_collected}
                        detail={`of ${requests.units_requested} requested (${share(requests.units_collected, requests.units_requested)})`} />
                    <Stat label="Median time to first offer" value={duration(requests.median_hours_to_first_offer)}
                        detail={`${requests.requests_with_offers} of ${requests.total} requests got an offer`} />
                    <Stat label="Median time to fulfil" value={duration(requests.median_hours_to_fulfilment)}
                        detail="from posting to the last unit confirmed" />
                    <Stat label="Offers completed" value={pct(offers.completion_rate)}
                        detail={`${offers.completed} completed · ${offers.cancelled} cancelled · ${offers.pending} pending`} />
                </dl>
            </Section>

            <Section title={`Needs attention${attentionCount ? ` (${attentionCount})` : ''}`} id="insights-attention">
                {attentionCount === 0 && attention.pending_offers_7d === 0 && (
                    <Card><CardBody className="text-sm text-gray-700">Nothing needs attention right now.</CardBody></Card>
                )}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {attention.expired_active.length > 0 && (
                        <Card>
                            <CardHeader className="py-3 sm:py-3">
                                <h4 className="flex items-center gap-2 font-semibold text-gray-900">
                                    <Clock size={18} className="text-warning-700" aria-hidden="true" />
                                    Past their date but still active ({requests.expired_active})
                                </h4>
                                <p className="text-xs text-gray-600">Hidden from the public already. Close them to keep the numbers honest.</p>
                            </CardHeader>
                            <CardBody className="py-0 sm:py-0">
                                <ul className="divide-y divide-gray-100">
                                    {attention.expired_active.map(r => (
                                        <RequestRow key={r.id} r={r} action={
                                            <Button size="sm" variant="outline" onClick={() => setClosing(r)}
                                                aria-label={`Close request for ${r.blood_group} at ${r.hospital_name}`}>
                                                Close
                                            </Button>
                                        } />
                                    ))}
                                </ul>
                            </CardBody>
                        </Card>
                    )}
                    {attention.no_offers_24h_count > 0 && (
                        <Card>
                            <CardHeader className="py-3 sm:py-3">
                                <h4 className="flex items-center gap-2 font-semibold text-gray-900">
                                    <AlertTriangle size={18} className="text-red-600" aria-hidden="true" />
                                    Open over 24 h with no offers ({attention.no_offers_24h_count})
                                </h4>
                                <p className="text-xs text-gray-600">Consider sharing these or alerting donors again.</p>
                            </CardHeader>
                            <CardBody className="py-0 sm:py-0">
                                <ul className="divide-y divide-gray-100">
                                    {attention.no_offers_24h.map(r => <RequestRow key={r.id} r={r} />)}
                                </ul>
                            </CardBody>
                        </Card>
                    )}
                    {attention.whatsapp_failures.length > 0 && (
                        <Card>
                            <CardHeader className="py-3 sm:py-3">
                                <h4 className="flex items-center gap-2 font-semibold text-gray-900">
                                    <MessageSquareWarning size={18} className="text-red-600" aria-hidden="true" />
                                    Failed WhatsApp sends, 7 days ({whatsapp.last_7d.failed})
                                </h4>
                            </CardHeader>
                            <CardBody className="py-0 sm:py-0">
                                <ul className="divide-y divide-gray-100">
                                    {attention.whatsapp_failures.map(f => (
                                        <li key={f.id} className="py-3">
                                            <p className="text-sm font-medium text-gray-900">
                                                <span className="capitalize">{f.kind.replace(/_/g, ' ')}</span>
                                                {f.request_id && <span className="text-gray-600"> · request #{f.request_id.slice(0, 8)}</span>}
                                            </p>
                                            <p className="text-xs text-gray-600">{f.error || 'No error detail'} · {dateTime(f.created_at)}</p>
                                        </li>
                                    ))}
                                </ul>
                            </CardBody>
                        </Card>
                    )}
                    {(attention.donors_without_location > 0 || attention.pending_offers_7d > 0) && (
                        <Card>
                            <CardHeader className="py-3 sm:py-3">
                                <h4 className="flex items-center gap-2 font-semibold text-gray-900">
                                    <MapPinOff size={18} className="text-warning-700" aria-hidden="true" />
                                    Data to tidy up
                                </h4>
                            </CardHeader>
                            <CardBody>
                                <ul className="space-y-2 text-sm text-gray-700">
                                    {attention.donors_without_location > 0 && (
                                        <li><span className="font-semibold text-gray-900">{attention.donors_without_location}</span> donors have no usable location, so they never show up in nearby searches. Run the location backfill or ask them to add their PIN code.</li>
                                    )}
                                    {attention.pending_offers_7d > 0 && (
                                        <li><span className="font-semibold text-gray-900">{attention.pending_offers_7d}</span> offers have been pending for over 7 days.</li>
                                    )}
                                    {people.donors_without_blood_group > 0 && (
                                        <li><span className="font-semibold text-gray-900">{people.donors_without_blood_group}</span> donors have no blood group.</li>
                                    )}
                                </ul>
                            </CardBody>
                        </Card>
                    )}
                </div>
            </Section>

            <Section title={`Last ${data.days} days`} id="insights-trend">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <TrendChart title="Sign-ups" data={trend} dataKey="signups" />
                    <TrendChart title="Requests posted" data={trend} dataKey="requests" />
                    <TrendChart title="Completed donations" data={trend} dataKey="donations" />
                </div>
            </Section>

            <Section title="Donors" id="insights-donors">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <Card>
                        <CardHeader className="py-3 sm:py-3"><h4 className="font-semibold text-gray-700">Donors by blood group</h4></CardHeader>
                        <div className="h-48 px-2 py-3 sm:px-3" aria-hidden="true">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={donorGroups} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                    <XAxis dataKey="label" fontSize={12} stroke={AXIS} tickLine={false} />
                                    <YAxis allowDecimals={false} fontSize={11} stroke={AXIS} tickLine={false} axisLine={false} />
                                    <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={tooltipStyle} formatter={(v) => [v, 'Donors']} />
                                    <Bar dataKey="count" fill={BRAND} radius={[4, 4, 0, 0]} maxBarSize={32} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <p className="sr-only">
                            Donors by blood group: {donorGroups.map(g => `${g.label} ${g.count} (${g.available} available)`).join(', ') || 'none yet'}.
                        </p>
                    </Card>
                    <Card>
                        <CardHeader className="py-3 sm:py-3"><h4 className="font-semibold text-gray-700">Account health</h4></CardHeader>
                        <CardBody className="space-y-3">
                            <Meter label="Consent recorded" value={people.consent_recorded} total={people.accounts} />
                            <Meter label="Email confirmed" value={people.email_confirmed} total={people.accounts} />
                            <Meter label="Phone verified" value={people.phone_verified} total={people.accounts} />
                            <Meter label="Donors with a location" value={people.donors - people.donors_without_location} total={people.donors} />
                            <Meter label="Donors on WhatsApp alerts" value={people.whatsapp_opted_in_donors} total={people.donors} />
                            <p className="text-xs text-gray-600">
                                {people.consent_missing} without consent · {people.email_unconfirmed} unconfirmed emails{people.no_email ? ` · ${people.no_email} without email` : ''} · {people.phone_unverified} unverified phones · {people.no_phone} without a phone
                            </p>
                        </CardBody>
                    </Card>
                </div>
                <Card>
                    <CardBody className="overflow-x-auto p-0 sm:p-0">
                        <table className="min-w-full text-sm">
                            <caption className="px-4 pt-3 pb-2 text-left font-semibold text-gray-700">Top cities</caption>
                            <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                                <tr>
                                    <th scope="col" className="px-4 py-2 text-left font-medium">City</th>
                                    <th scope="col" className="px-4 py-2 text-right font-medium">Donors</th>
                                    <th scope="col" className="px-4 py-2 text-right font-medium">Accounts</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {people.top_cities.map(c => (
                                    <tr key={c.label}>
                                        <th scope="row" className="px-4 py-2 text-left font-medium text-gray-900">{c.label}</th>
                                        <td className="px-4 py-2 text-right tabular-nums">{c.donors}</td>
                                        <td className="px-4 py-2 text-right tabular-nums">{c.accounts}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </CardBody>
                </Card>
            </Section>

            <Section title="Requests and offers" id="insights-requests">
                <dl className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                    <Stat label="Requests, all time" value={requests.total}
                        detail={`${requests.open} open · ${requests.expired_active} expired · ${requests.fulfilled} fulfilled · ${requests.cancelled} cancelled`} />
                    <Stat label="Offers made" value={offers.total}
                        detail={`${offers.offers_per_request ?? '–'} per request · ${offers.last_7d} this week`} />
                    <Stat label="Units donated" value={offers.units_donated} detail={`${offers.completed} completed donations`} />
                    <Stat label="Offers via WhatsApp" value={share(offers.from_whatsapp, offers.total)}
                        detail={`${offers.from_whatsapp} WhatsApp · ${offers.from_web} web`} />
                </dl>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <BreakdownTable caption="By blood group" firstColumn="Group" rows={[...requests.by_blood_group].sort(byBloodGroup)} />
                    <BreakdownTable caption="By urgency" firstColumn="Urgency" rows={requests.by_urgency} />
                    <BreakdownTable caption="By city (top 10)" firstColumn="City" rows={requests.by_city} />
                </div>
            </Section>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                <Section title="WhatsApp" id="insights-whatsapp">
                    <Card>
                        <CardBody className="overflow-x-auto p-0 sm:p-0">
                            <table className="min-w-full text-sm">
                                <caption className="px-4 pt-3 pb-2 text-left text-xs text-gray-600">
                                    Outbound messages. {whatsapp.inbound_30d} received in 30 days.
                                </caption>
                                <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                                    <tr>
                                        <th scope="col" className="px-4 py-2 text-left font-medium">Status</th>
                                        <th scope="col" className="px-4 py-2 text-right font-medium">7 days</th>
                                        <th scope="col" className="px-4 py-2 text-right font-medium">30 days</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {statusKeys.map(s => (
                                        <tr key={s}>
                                            <th scope="row" className="px-4 py-2 text-left font-medium capitalize text-gray-900">
                                                {s === 'failed' ? <Badge variant="error" size="sm">failed</Badge> : s}
                                            </th>
                                            <td className="px-4 py-2 text-right tabular-nums">{whatsapp.last_7d.by_status[s] ?? 0}</td>
                                            <td className="px-4 py-2 text-right tabular-nums">{whatsapp.last_30d.by_status[s] ?? 0}</td>
                                        </tr>
                                    ))}
                                    {kindKeys.map(k => (
                                        <tr key={`kind-${k}`} className="bg-gray-50/50">
                                            <th scope="row" className="px-4 py-2 text-left font-normal capitalize text-gray-700">{k.replace(/_/g, ' ')} messages</th>
                                            <td className="px-4 py-2 text-right tabular-nums">{whatsapp.last_7d.by_kind[k] ?? 0}</td>
                                            <td className="px-4 py-2 text-right tabular-nums">{whatsapp.last_30d.by_kind[k] ?? 0}</td>
                                        </tr>
                                    ))}
                                    <tr>
                                        <th scope="row" className="px-4 py-2 text-left font-semibold text-gray-900">Total sent</th>
                                        <td className="px-4 py-2 text-right font-semibold tabular-nums">{whatsapp.last_7d.total}</td>
                                        <td className="px-4 py-2 text-right font-semibold tabular-nums">{whatsapp.last_30d.total}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </CardBody>
                    </Card>
                </Section>

                <Section title="Referrals" id="insights-referrals">
                    <Card>
                        <CardBody className="space-y-3">
                            <p className="text-sm text-gray-700">
                                <span className="text-2xl font-bold text-gray-900 tabular-nums">{referrals.total}</span> donors joined through a referral
                                ({referrals.last_30d} in 30 days, from {referrals.referrers} referrers).
                            </p>
                            {referrals.top_referrers.length > 0 ? (
                                <ol className="divide-y divide-gray-100 text-sm">
                                    {referrals.top_referrers.map((r, i) => (
                                        <li key={`${r.name}-${i}`} className="flex justify-between py-2">
                                            <span className="text-gray-900">{i + 1}. {r.name}</span>
                                            <span className="tabular-nums text-gray-700">{r.count}</span>
                                        </li>
                                    ))}
                                </ol>
                            ) : (
                                <p className="text-sm text-gray-600">No referrals yet.</p>
                            )}
                        </CardBody>
                    </Card>
                </Section>
            </div>

            <ConfirmationModal
                isOpen={!!closing}
                onClose={() => setClosing(null)}
                onConfirm={closeRequest}
                isLoading={closeBusy}
                title="Close this request?"
                description={closing ? `The ${closing.blood_group} request at ${closing.hospital_name} is past its needed-by date. Closing marks it as cancelled; it stays in the records.` : ''}
                confirmText="Close request"
                variant="danger"
            />
        </div>
    );
}
