
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import DonorCard from '@/components/DonorCard';
import Link from 'next/link';
import { calculateAchievements } from '@/lib/stats';
import PublicProfileHeader from '../components/PublicProfileHeader';
import { parseDonorSlug } from '@/lib/donor-slug';

// Set revalidation time to 0 for instant updates
export const revalidate = 0;

interface Props {
    params: Promise<{
        id: string; // Next.js 15+ params are Promises
    }>;
}

export async function generateMetadata({ params }: Props) {
    const { id } = await params;
    const decodedId = decodeURIComponent(id);
    const displayName = decodedId.split('@')[0];

    const title = `${displayName} is a blood donor`;
    const description = 'A donor card from Vital, the free and voluntary blood donor network.';
    return {
        title,
        description,
        alternates: { canonical: `/donor/${id}` },
        openGraph: { title, description, url: `/donor/${id}` },
        twitter: { card: 'summary_large_image', title, description },
    };
}

// Private Profile Component
function PrivateProfilePage({ displayName }: { displayName: string }) {
    return (
        <div className="flex min-h-screen flex-col">
            <PublicProfileHeader />
            <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-5 pb-24">
                <h1 className="display text-4xl sm:text-5xl">
                    This donor card is private
                </h1>
                <p className="mt-5 text-lg leading-relaxed text-gray-600">
                    If you are able to give blood, you can register as a donor on Vital. It is free and voluntary.
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
    const decodedId = decodeURIComponent(id);
    const displayName = decodedId.split('@')[0] || 'This user';

    // Parse the vanity slug
    const parsed = parseDonorSlug(decodedId);
    if (!parsed) {
        return notFound();
    }
    const { lookupId, isUuid, isDonorNumber } = parsed;

    // Create Supabase client
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

    // Get current user (if logged in)
    const { data: { user: currentUser } } = await supabase.auth.getUser();

    // Build and execute query
    // public_donor_card only answers for donors, and only reveals name and blood
    // group when the card is public (or the viewer is the owner).
    const { data: donor, error } = await supabase
        .rpc('public_donor_card', isUuid ? { p_id: lookupId } : { p_donor_number: parseInt(lookupId) })
        .maybeSingle<{ id: string; donor_number: number; display_name: string | null; blood_group: string | null; is_public_profile: boolean }>();

    // Profile not found - return 404
    if (error || !donor) {
        return notFound();
    }

    // Check visibility: Is the profile public OR is the viewer the owner?
    const isOwner = currentUser?.id === donor.id;
    const isPublic = donor.is_public_profile === true;

    if (!isPublic && !isOwner) {
        // Profile is private and viewer is not the owner
        return <PrivateProfilePage displayName={displayName} />;
    }

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
            <main className="mx-auto grid w-full max-w-6xl flex-1 content-center items-center gap-12 px-5 pb-20 pt-6 sm:px-8 lg:grid-cols-2 lg:gap-20">
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
