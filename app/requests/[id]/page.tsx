import { cache } from 'react';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase-server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { ArrowLeft } from 'lucide-react';
import { RequestShareActions } from '@/components/ShareButton';
import { formatBloodGroup, getCompatibleDonors, isBloodCompatible } from '@/lib/blood-compatibility';
import { URGENCY_LABEL, buildRequestShare, placeLabel, requestDescription, requestPath, type ShareableRequest } from '@/lib/share';
import { SITE_URL } from '@/lib/site';
import type { BloodRequest } from '@/types';
import { REQUEST_PUBLIC_COLUMNS, isRequestOpen } from '@/lib/requests';

export const dynamic = 'force-dynamic';

interface Props {
    params: Promise<{ id: string }>;
}

// Public columns only (see lib/requests.ts). RLS hides requests that are closed
// or past their needed-by date, so those 404 here.
// Cached per render so generateMetadata and the page share one query.
const getRequest = cache(async (id: string) => {
    const supabase = await createClient();
    const { data } = await supabase.from('blood_requests').select(REQUEST_PUBLIC_COLUMNS).eq('id', id).maybeSingle();
    return { supabase, request: data as unknown as BloodRequest | null };
});



export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    const { request } = await getRequest(id);

    // Closed or past its needed-by date: the preview must not ask for blood.
    if (!request || !isRequestOpen(request)) {
        return {
            title: 'Request not available',
            description: 'This blood request has been closed or is no longer available. See open requests on Vital.',
            robots: { index: false },
        };
    }

    // e.g. "Urgent: B+ blood needed at General Hospital, Kochi"
    const urgency = URGENCY_LABEL[request.urgency_level];
    const place = placeLabel(request.hospital_name, request.city);
    const title = `${urgency ? `${urgency}: ` : ''}${formatBloodGroup(request.blood_group)} blood needed${place ? ` at ${place}` : ''}`;
    const description = requestDescription(request);
    const path = requestPath(id);

    // openGraph/twitter images come from ./opengraph-image.tsx: Next merges file-based images
    // whenever openGraph.images is not set here, and twitter inherits them from openGraph.
    return {
        title,
        description,
        alternates: { canonical: path },
        openGraph: { title, description, url: `${SITE_URL}${path}`, type: 'website', siteName: 'Vital', locale: 'en_IN' },
        twitter: { card: 'summary_large_image', title, description },
    };
}

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

    // Owners manage their requests from My requests; the public page never knows the poster.
    const isOwn = false;
    const isOpen = isRequestOpen(request);
    const isUrgent = request.urgency_level === 'High';
    const group = formatBloodGroup(request.blood_group);
    const donors = getCompatibleDonors(request.blood_group).map(formatBloodGroup);
    const incompatible = !!userBloodGroup && !isBloodCompatible(userBloodGroup, request.blood_group);
    const units = `${request.units_needed} unit${request.units_needed > 1 ? 's' : ''}`;
    // Only the fields a share needs go to the client component.
    const shareable: ShareableRequest = {
        id: request.id,
        blood_group: request.blood_group,
        units_needed: request.units_needed,
        hospital_name: request.hospital_name,
        city: request.city,
        date_needed: request.date_needed,
        urgency_level: request.urgency_level,
        status: request.status,
    };
    const share = buildRequestShare(shareable, SITE_URL);
    const posterFileName = `vital-${request.blood_group.replace('+', 'pos').replace('-', 'neg')}-blood-request.png`;

    const details = [
        ['Hospital', request.hospital_name],
        ['Address', request.hospital_address],
        ['City', [request.city, request.zipcode].filter(Boolean).join(' · ')],
        ['Needed by', request.date_needed ? format(parseISO(request.date_needed), 'EEEE, d MMMM') : null],
        ['Contact person', request.contact_name],
    ].filter(([, v]) => v) as [string, string][];

    return (
        <div className="mx-auto max-w-3xl">
            <Link href="/requests" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to requests
            </Link>

            {!isOpen && (
                <div className="mt-6 rounded-md border-l-2 border-success-600 bg-success-50 px-4 py-3 text-sm text-success-800">
                    This request is {request.status === 'fulfilled' ? 'fulfilled. Thank you to everyone who responded.' : 'closed.'}
                </div>
            )}

            <header className="mt-8 flex items-start gap-5 sm:gap-8">
                <div className={`flex h-24 w-24 shrink-0 items-center justify-center rounded-lg font-serif text-4xl tracking-tight sm:h-28 sm:w-28 sm:text-5xl ${isUrgent && isOpen ? 'bg-red-600 text-white' : 'bg-gray-900 text-gray-50'}`}>
                    {group}
                </div>
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${isUrgent ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                            {URGENCY_LABEL[request.urgency_level]}
                        </span>
                        <span className="text-sm text-gray-500">
                            Posted {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                        </span>
                    </div>
                    <h1 className="display mt-3 text-3xl sm:text-[2.75rem]">
                        {group} blood needed at {request.hospital_name}
                    </h1>
                    <p className="mt-2 text-gray-600">{units} required</p>
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
                        <dt className="text-sm text-gray-500">Notes</dt>
                        <dd className="leading-relaxed text-gray-700 sm:col-span-2">{request.notes}</dd>
                    </div>
                )}
            </dl>

            {isOpen && (
                <section className="mt-10 rounded-lg border border-gray-200 bg-white p-6 sm:p-8">
                    <h2 className="text-lg font-medium text-gray-900">Donating for this request</h2>
                    <p className="mt-2 leading-relaxed text-gray-600">
                        Donors with blood group <span className="text-gray-900">{donors.join(', ')}</span> can donate to this patient.
                    </p>

                    <div className="mt-6 flex flex-wrap items-center gap-3">
                        {isOwn ? (
                            <Link href="/requests/my-requests" className="inline-flex h-11 items-center rounded-md bg-gray-900 px-5 text-sm font-medium text-gray-50 hover:bg-gray-800">
                                Manage this request
                            </Link>
                        ) : hasOffered ? (
                            <Link href="/donations" className="inline-flex h-11 items-center rounded-md bg-gray-900 px-5 text-sm font-medium text-gray-50 hover:bg-gray-800">
                                You have offered · View your PIN
                            </Link>
                        ) : incompatible ? (
                            <p className="text-sm text-gray-500">
                                Your blood group ({formatBloodGroup(userBloodGroup)}) is not compatible with this patient. You can still share the request with others.
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

                </section>
            )}

            {isOpen && (
                <section className="mt-6 rounded-lg border border-gray-200 bg-white p-6 sm:p-8">
                    <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
                        <a
                            href={`${requestPath(request.id)}/poster`}
                            target="_blank"
                            rel="noopener"
                            className="block w-32 shrink-0 overflow-hidden rounded-md border border-gray-200 sm:w-36"
                            aria-label="Open the poster for this request"
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={`${requestPath(request.id)}/poster`}
                                alt={`Poster: ${share.title}`}
                                width={1080}
                                height={1350}
                                loading="lazy"
                                className="h-auto w-full"
                            />
                        </a>
                        <div className="min-w-0 flex-1">
                            <h2 className="text-lg font-medium text-gray-900">Share this request</h2>
                            <p className="mt-1 text-sm leading-relaxed text-gray-600">
                                Forward it to friends, family and local groups. The link shows the blood group, urgency and place, and the poster fits WhatsApp Status and Instagram. The contact number is never shared.
                            </p>
                            <pre className="mt-4 whitespace-pre-wrap break-words rounded-md bg-gray-50 p-3 font-sans text-[13px] leading-relaxed text-gray-700">{share.message.replace(/\*/g, '')}</pre>
                            <div className="mt-4">
                                <RequestShareActions request={shareable} posterFileName={posterFileName} />
                            </div>
                        </div>
                    </div>
                </section>
            )}
        </div>
    );
}
