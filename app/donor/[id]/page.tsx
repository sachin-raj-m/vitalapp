
import { cache } from 'react';
import type { Metadata } from 'next';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import DonorCard from '@/components/DonorCard';
import Link from 'next/link';
import { calculateAchievements } from '@/lib/stats';
import PublicProfileHeader from '../components/PublicProfileHeader';
import { donorProfilePath, parseDonorSlug } from '@/lib/donor-slug';

// Set revalidation time to 0 for instant updates
export const revalidate = 0;

interface Props {
    params: Promise<{
        id: string; // Next.js 15+ params are Promises
    }>;
}

type DonorCardRow = { id: string; donor_number: number; display_name: string | null; blood_group: string | null; is_public_profile: boolean };

// One lookup per request, shared by generateMetadata and the page.
// public_donor_card returns nothing for private cards (unless the viewer owns
// it) and for unknown ids, so the two cases can't be told apart from outside.
const getDonor = cache(async (slug: string) => {
    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
            },
        }
    );

    const parsed = parseDonorSlug(slug);
    if (!parsed) return { supabase, donor: null };

    const { data, error } = await supabase
        .rpc('public_donor_card', parsed.isUuid ? { p_id: parsed.lookupId } : { p_donor_number: parseInt(parsed.lookupId) })
        .maybeSingle<DonorCardRow>();
    return { supabase, donor: error ? null : data };
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    const { donor } = await getDonor(decodeURIComponent(id));

    // Titles come from the database, never from the URL, so a link can't be
    // crafted to show someone else's name in its preview.
    if (!donor?.is_public_profile) {
        return {
            title: 'Donor card',
            description: 'A donor card on Vital, the free and voluntary blood donor network.',
            robots: { index: false, follow: false },
        };
    }

    const firstName = donor.display_name?.split(' ')[0] || 'A Vital donor';
    const path = donorProfilePath({ full_name: donor.display_name, donor_number: donor.donor_number, id: donor.id });
    const title = `${firstName} is a blood donor`;
    const description = 'A donor card from Vital, the free and voluntary blood donor network.';
    return {
        title,
        description,
        alternates: { canonical: path },
        openGraph: { title, description, url: path },
        twitter: { card: 'summary_large_image', title, description },
    };
}

// Shown for private cards and for links that don't match a donor; the two are
// deliberately indistinguishable so registrations can't be enumerated.
function UnavailableProfilePage() {
    return (
        <div className="flex min-h-screen flex-col">
            <PublicProfileHeader />
            <main id="main" tabIndex={-1} className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-5 pb-24">
                <h1 className="display text-4xl sm:text-5xl">
                    This donor card isn&rsquo;t available
                </h1>
                <p className="mt-5 text-lg leading-relaxed text-gray-600">
                    It may be private, or the link may be incomplete. If you are able to give blood, you can register as a donor on Vital. It is free and voluntary.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                    <Link href="/register" className="inline-flex h-11 items-center rounded-md bg-red-600 px-5 text-sm font-medium text-white hover:bg-red-700">
                        Become a donor
                    </Link>
                    <Link href="/" className="inline-flex h-11 items-center rounded-md border border-gray-300 px-5 text-sm font-medium text-gray-900 hover:border-gray-400">
                        What is Vital?
                    </Link>
                </div>
            </main>
        </div>
    );
}

export default async function PublicDonorPage({ params }: Props) {
    const { id } = await params;
    const { supabase, donor } = await getDonor(decodeURIComponent(id));
    if (!donor) return <UnavailableProfilePage />;

    const { data: { user: currentUser } } = await supabase.auth.getUser();
    const isOwner = currentUser?.id === donor.id;
    if (!donor.is_public_profile && !isOwner) return <UnavailableProfilePage />;

    // A private card previewed by its owner shows their full name.
    let fullName: string | null = donor.display_name;
    if (isOwner) {
        const { data: own } = await supabase.from('profiles').select('full_name').eq('id', donor.id).maybeSingle();
        fullName = own?.full_name ?? fullName;
    }
    const profile = { id: donor.id, full_name: fullName, blood_group: donor.blood_group, donor_number: donor.donor_number };

    // Completed donations, via an RPC that only answers for public cards (or the owner).
    const { data: activity } = await supabase.rpc('public_donor_activity', { p_donor_id: donor.id });
    const donations = (activity || []).map((a: any) => ({
        created_at: a.created_at,
        status: a.status,
        blood_requests: { urgency_level: a.urgency_level },
    }));
    const donationCount = donations.length;

    const allAchievements = calculateAchievements(donations);
    const unlockedAchievements = allAchievements.filter(a => a.unlocked);

    const firstName = profile.full_name?.split(' ')[0] || 'This donor';

    return (
        <div className="flex min-h-screen flex-col">
            <PublicProfileHeader />
            <main id="main" tabIndex={-1} className="mx-auto grid w-full max-w-6xl flex-1 content-center items-center gap-12 px-5 pb-20 pt-6 sm:px-8 lg:grid-cols-2 lg:gap-20">
                <div className="animate-fade-up">
                    <h1 className="display text-5xl sm:text-6xl">
                        {firstName} is a registered blood donor
                    </h1>
                    <p className="mt-6 max-w-md text-lg leading-relaxed text-gray-600">
                        {donationCount > 0
                            ? `${firstName} has donated ${donationCount} ${donationCount === 1 ? 'time' : 'times'} through Vital, a free network that connects voluntary donors with patients nearby.`
                            : `${firstName} is registered on Vital, a free network that connects voluntary donors with patients nearby.`}
                    </p>
                    <div className="mt-8 flex flex-wrap gap-3">
                        <Link href="/register" className="inline-flex h-11 items-center rounded-md bg-red-600 px-5 text-sm font-medium text-white hover:bg-red-700">
                            Become a donor
                        </Link>
                        <Link href="/requests" className="inline-flex h-11 items-center rounded-md border border-gray-300 px-5 text-sm font-medium text-gray-900 hover:border-gray-400">
                            See who needs blood
                        </Link>
                    </div>
                </div>

                <div className="flex justify-center lg:justify-end animate-fade-up [animation-delay:120ms]">
                    <DonorCard
                        user={profile}
                        showAchievements={unlockedAchievements.length > 0}
                        achievementCount={unlockedAchievements.length}
                        totalDonations={donationCount}
                        donorNumber={profile.donor_number}
                        badges={unlockedAchievements}
                        className="shadow-2xl shadow-[#e2e8f0]/50"
                    />
                </div>
            </main>
        </div>
    );
}
