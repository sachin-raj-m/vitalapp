
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import DonorCard from '@/components/DonorCard';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

// Set revalidation time to 0 for instant updates
export const revalidate = 0;

interface Props {
    params: {
        id: string;
    };
}

export async function generateMetadata({ params }: Props) {
    const { id } = params;
    const decodedId = decodeURIComponent(id);
    const displayName = decodedId.split('@')[0];

    return {
        title: `Donor Profile: ${displayName}`,
        description: 'View my official Verified Donor Card on Vital.',
    };
}

// Helper to parse the vanity URL slug
function parseSlugToLookupId(slug: string): { lookupId: string; isUuid: boolean; isDonorNumber: boolean } | null {
    let lookupId = slug;

    if (slug.includes('@')) {
        const parts = slug.split('@');
        const numericPart = parts.find(p => /^\d+$/.test(p));
        const uuidPart = parts.find(p => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p));

        if (numericPart) {
            lookupId = numericPart;
        } else if (uuidPart) {
            lookupId = uuidPart;
        } else {
            lookupId = parts[parts.length - 1];
        }
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lookupId);
    const isDonorNumber = /^\d+$/.test(lookupId);

    if (!isUuid && !isDonorNumber) {
        return null;
    }

    return { lookupId, isUuid, isDonorNumber };
}

export default async function PublicDonorPage({ params }: Props) {
    const { id } = params;
    const decodedId = decodeURIComponent(id);

    // Parse the vanity slug
    const parsed = parseSlugToLookupId(decodedId);
    if (!parsed) {
        return notFound();
    }
    const { lookupId, isUuid, isDonorNumber } = parsed;

    // Create Supabase client with cookies (for authenticated access)
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

    // Build the query
    const buildQuery = (client: typeof supabase) => {
        let query = client
            .from('profiles')
            .select('id, full_name, blood_group, is_donor, donor_number, is_public_profile');

        if (isUuid) {
            query = query.eq('id', lookupId);
        } else if (isDonorNumber) {
            query = query.eq('donor_number', parseInt(lookupId));
        }

        return query.single();
    };

    // Try fetching the profile
    let { data: profile, error } = await buildQuery(supabase);

    // If the first attempt fails (RLS denied), try again with a fresh anonymous client.
    // This handles the case where the server session is missing/stale.
    if (error && error.code === 'PGRST116') { // PGRST116 = "no rows returned"
        console.warn('⚠️ Initial query failed (likely RLS), trying anonymous fallback...');

        // Create an anonymous client (no cookies)
        const anonClient = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get() { return undefined; },
                },
            }
        );

        const fallback = await buildQuery(anonClient);
        profile = fallback.data;
        error = fallback.error;
    }

    // Still no profile? Return 404
    if (error || !profile) {
        console.error('❌ Public Profile Fetch Failed:', error);
        console.error('❌ Lookup ID:', lookupId);
        return notFound();
    }

    // Only show for donors
    if (!profile.is_donor) {
        return notFound();
    }

    // Fetch donation count
    const { count: donationCount } = await supabase
        .from('donations')
        .select('*', { count: 'exact', head: true })
        .eq('donor_id', profile.id);

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 relative overflow-hidden">
            {/* Background Mesh */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-red-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-orange-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
            </div>

            <main className="relative z-10 w-full max-w-md flex flex-col items-center space-y-8">
                {/* Logo */}
                <div className="flex items-center gap-2 mb-4">
                    <div className="bg-red-600 rounded-lg p-2">
                        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                    </div>
                    <span className="text-2xl font-bold text-slate-900 tracking-tight">Vital</span>
                </div>

                {/* The Card */}
                <div className="w-full transform hover:scale-105 transition-transform duration-300">
                    <DonorCard
                        user={profile}
                        showAchievements={true}
                        achievementCount={3}
                        totalDonations={donationCount || 0}
                        donorNumber={profile.donor_number}
                        className="shadow-xl"
                    />
                </div>

                {/* CTA */}
                <div className="text-center space-y-4 max-w-xs">
                    <h2 className="text-xl font-bold text-slate-800">
                        Join {profile.full_name?.split(' ')[0]} in saving lives.
                    </h2>
                    <p className="text-slate-600 text-sm">
                        Vital connects blood donors with people in need. Sign up today to become a hero.
                    </p>
                    <Link href="/register" className="block w-full">
                        <Button size="lg" className="w-full bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-200">
                            Become a Donor
                        </Button>
                    </Link>
                </div>
            </main>

            <footer className="absolute bottom-6 text-slate-400 text-xs">
                &copy; {new Date().getFullYear()} Vital App. All rights reserved.
            </footer>
        </div>
    );
}
