
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
                <p className="eyebrow">Private profile</p>
                <h1 className="display mt-4 text-5xl leading-[1]">
                    {displayName} keeps their card <em>private.</em>
                </h1>
                <p className="mt-5 text-lg leading-relaxed text-gray-600">
                    You can still help the way they do. Registering takes two minutes.
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
    let query = supabase
        .from('public_donors')
        .select('id, display_name, blood_group, donor_number, is_public_profile');

    if (isUuid) {
        query = query.eq('id', lookupId);
    } else if (isDonorNumber) {
        query = query.eq('donor_number', parseInt(lookupId));
    }

    const { data: donor, error } = await query.maybeSingle();

    // Profile not found - return 404
    // public_donors only contains donors, so a miss means not found or not a donor.
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
            <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-5 pb-20 pt-6 sm:px-8 lg:grid-cols-2 lg:gap-20">
                <div className="animate-fade-up">
                    <p className="eyebrow">Verified on Vital</p>
                    <h1 className="display mt-4 text-5xl leading-[0.98] sm:text-7xl">
                        {firstName} gives blood. <em className="text-red-600">Do you?</em>
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
                        totalDonations={donationCount}
                        donorNumber={profile.donor_number}
                        badges={unlockedAchievements}
                    />
                </div>
            </main>
        </div>
    );
}
