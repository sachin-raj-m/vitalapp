import { createClient } from '@/lib/supabase-server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { ArrowLeft } from 'lucide-react';
import { ShareButton } from '@/components/ShareButton';
import { formatBloodGroup, getCompatibleDonors, isBloodCompatible } from '@/lib/blood-compatibility';
import type { BloodRequest } from '@/types';

export const dynamic = 'force-dynamic';

interface Props {
    params: Promise<{ id: string }>;
}

async function getRequest(id: string) {
    const supabase = await createClient();
    const { data } = await supabase.from('blood_requests').select('*').eq('id', id).maybeSingle();
    return { supabase, request: data as BloodRequest | null };
}

export async function generateMetadata({ params }: Props) {
    const { id } = await params;
    const { request } = await getRequest(id);

    if (!request) return { title: 'Request not found' };

    const group = formatBloodGroup(request.blood_group);
    const title = `${group} blood needed at ${request.hospital_name}`;
    const description = `${request.units_needed} unit(s) of ${group} needed at ${request.hospital_name}${request.city ? `, ${request.city}` : ''}. Can you help?`;
    return {
        title,
        description,
        alternates: { canonical: `/requests/${id}` },
        openGraph: { title, description, url: `/requests/${id}`, type: 'article' },
        twitter: { card: 'summary_large_image', title, description },
    };
}

const URGENCY_LABEL = { High: 'Urgent', Medium: 'Soon', Low: 'Planned' } as const;

export default async function RequestDetailsPage({ params }: Props) {
    const { id } = await params;
    const { supabase, request } = await getRequest(id);

    if (!request) notFound();

    const { data: { user } } = await supabase.auth.getUser();
    let hasOffered = false;
    let userBloodGroup: BloodRequest['blood_group'] | null = null;

    if (user) {
        const [{ data: donation }, { data: profile }] = await Promise.all([
            supabase.from('donations').select('id').eq('request_id', request.id).eq('donor_id', user.id).neq('status', 'cancelled').maybeSingle(),
            supabase.from('profiles').select('blood_group').eq('id', user.id).maybeSingle(),
        ]);
        hasOffered = !!donation;
        userBloodGroup = profile?.blood_group ?? null;
    }

    const isOwn = request.user_id === user?.id;
    const isOpen = request.status === 'active';
    const isUrgent = request.urgency_level === 'High';
    const group = formatBloodGroup(request.blood_group);
    const donors = getCompatibleDonors(request.blood_group).map(formatBloodGroup);
    const incompatible = !!userBloodGroup && !isBloodCompatible(userBloodGroup, request.blood_group);
    const units = `${request.units_needed} unit${request.units_needed > 1 ? 's' : ''}`;

    const details = [
        ['Hospital', request.hospital_name],
        ['Address', request.hospital_address],
        ['City', [request.city, request.zipcode].filter(Boolean).join(' · ')],
        ['Needed by', request.date_needed ? format(parseISO(request.date_needed), 'EEEE, d MMMM') : null],
        ['Requested for', request.contact_name],
    ].filter(([, v]) => v) as [string, string][];

    return (
        <div className="mx-auto max-w-3xl">
            <Link href="/requests" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900">
                <ArrowLeft className="h-3.5 w-3.5" /> All requests
            </Link>

            {!isOpen && (
                <div className="mt-6 rounded-md border-l-2 border-success-600 bg-success-50 px-4 py-3 text-sm text-success-800">
                    This request is {request.status === 'fulfilled' ? 'fulfilled. Thank you to everyone who helped.' : 'closed.'}
                </div>
            )}

            <header className="mt-8 flex items-start gap-5 sm:gap-8">
                <div className={`flex h-24 w-24 shrink-0 items-center justify-center rounded-lg font-serif text-5xl tracking-tight sm:h-32 sm:w-32 sm:text-6xl ${isUrgent && isOpen ? 'bg-red-600 text-white' : 'bg-gray-900 text-gray-50'}`}>
                    {group}
                </div>
                <div className="min-w-0">
                    <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-gray-500">
                        <span className={isUrgent ? 'text-red-600' : ''}>{URGENCY_LABEL[request.urgency_level]}</span>
                        {' · '}posted {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                    </p>
                    <h1 className="display mt-3 text-4xl leading-[1.02] sm:text-5xl">
                        {units} of {group} needed at {request.hospital_name}.
                    </h1>
                </div>
            </header>

            <dl className="mt-10 divide-y divide-gray-200 border-y border-gray-200">
                {details.map(([k, v]) => (
                    <div key={k} className="grid gap-1 py-4 sm:grid-cols-3 sm:gap-6">
                        <dt className="text-sm text-gray-500">{k}</dt>
                        <dd className="text-gray-900 sm:col-span-2">{v}</dd>
                    </div>
                ))}
                {request.notes && (
                    <div className="grid gap-1 py-4 sm:grid-cols-3 sm:gap-6">
                        <dt className="text-sm text-gray-500">Note from the family</dt>
                        <dd className="italic leading-relaxed text-gray-700 sm:col-span-2">{request.notes}</dd>
                    </div>
                )}
            </dl>

            {isOpen && (
                <section className="mt-10 rounded-lg border border-gray-200 bg-white p-6 sm:p-8">
                    <h2 className="text-xl font-medium tracking-tight text-gray-900">Can you donate?</h2>
                    <p className="mt-2 leading-relaxed text-gray-600">
                        People with <span className="text-gray-900">{donors.join(', ')}</span> blood can give to this patient.
                    </p>

                    <div className="mt-6 flex flex-wrap items-center gap-3">
                        {isOwn ? (
                            <Link href="/requests/my-requests" className="inline-flex h-11 items-center rounded-md bg-gray-900 px-5 text-sm font-medium text-gray-50 hover:bg-gray-800">
                                Manage this request
                            </Link>
                        ) : hasOffered ? (
                            <Link href="/donations" className="inline-flex h-11 items-center rounded-md bg-gray-900 px-5 text-sm font-medium text-gray-50 hover:bg-gray-800">
                                You’ve offered · see your PIN
                            </Link>
                        ) : incompatible ? (
                            <p className="text-sm text-gray-500">
                                Your group ({formatBloodGroup(userBloodGroup)}) isn’t compatible, but sharing this helps just as much.
                            </p>
                        ) : (
                            <Link
                                href={`/requests?offer=${request.id}`}
                                className="inline-flex h-11 items-center rounded-md bg-red-600 px-5 text-sm font-medium text-white hover:bg-red-700"
                            >
                                I can donate
                            </Link>
                        )}
                        {!user && (
                            <Link href="/register" className="inline-flex h-11 items-center rounded-md border border-gray-300 px-5 text-sm font-medium text-gray-900 hover:border-gray-400">
                                Register as a donor
                            </Link>
                        )}
                    </div>

                    <div className="mt-6 flex items-center justify-between border-t border-gray-200 pt-4">
                        <p className="text-[13px] text-gray-500">Not a match? Forward it to someone who might be.</p>
                        <ShareButton
                            title={`${group} blood needed: ${units} at ${request.hospital_name}`}
                            text={`${request.hospital_name}${request.city ? `, ${request.city}` : ''} needs ${units} of ${group}.`}
                            path={`/requests/${request.id}`}
                        />
                    </div>
                </section>
            )}
        </div>
    );
}
