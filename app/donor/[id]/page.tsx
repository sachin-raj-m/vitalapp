
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import DonorCard from '@/components/DonorCard';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { Lock, Shield, ArrowLeft } from 'lucide-react';
import { calculateAchievements } from '@/lib/stats';

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

// Private Profile Component
function PrivateProfilePage({ displayName }: { displayName: string }) {
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-slate-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-slate-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30"></div>
            </div>

            <main className="relative z-10 w-full max-w-md flex flex-col items-center text-center space-y-6 p-8">
                <div className="p-4 bg-slate-100 rounded-full">
                    <Lock className="w-12 h-12 text-slate-400" />
                </div>

                <h1 className="text-2xl font-bold text-slate-800">Profile is Private</h1>

                <p className="text-slate-600">
                    <span className="font-semibold">{displayName}</span> has chosen to keep their donor profile private.
                </p>

                <div className="bg-white p-4 rounded-xl border border-slate-200 text-left w-full">
                    <div className="flex items-start gap-3">
                        <Shield className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                        <div>
                            <h3 className="font-semibold text-slate-800 text-sm">Privacy Protected</h3>
                            <p className="text-slate-500 text-xs mt-1">
                                Vital respects donor privacy. Profile owners control who can see their information.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="pt-4 space-y-3 w-full">
                    <Link href="/register" className="block w-full">
                        <Button size="lg" className="w-full bg-red-600 hover:bg-red-700 text-white">
                            Become a Donor
                        </Button>
                    </Link>
                    <Link href="/" className="block w-full">
                        <Button size="lg" variant="outline" className="w-full">
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Go to Home
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

export default async function PublicDonorPage({ params }: Props) {
    const { id } = await params;
    const decodedId = decodeURIComponent(id);
    const displayName = decodedId.split('@')[0] || 'This user';

    // Parse the vanity slug
    const parsed = parseSlugToLookupId(decodedId);
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
        .from('profiles')
        .select('id, full_name, blood_group, is_donor, donor_number, is_public_profile');

    if (isUuid) {
        query = query.eq('id', lookupId);
    } else if (isDonorNumber) {
        query = query.eq('donor_number', parseInt(lookupId));
    }

    const { data: profile, error } = await query.single();

    // Profile not found - return 404
    if (error || !profile) {
        return notFound();
    }

    // Only show for donors
    if (!profile.is_donor) {
        return notFound();
    }

    // Check visibility: Is the profile public OR is the viewer the owner?
    const isOwner = currentUser?.id === profile.id;
    const isPublic = profile.is_public_profile === true;

    if (!isPublic && !isOwner) {
        // Profile is private and viewer is not the owner
        return <PrivateProfilePage displayName={displayName} />;
    }

    // Fetch Full Donation Stats for Badges
    const { data: donations } = await supabase
        .from('donations')
        .select('created_at, status, blood_requests(urgency_level)')
        .eq('donor_id', profile.id)
        .order('created_at', { ascending: false });

    const completedDonations = (donations || []).filter(d => d.status === 'completed');
    const donationCount = completedDonations.length;

    // Calculate Achievements safely
    const allAchievements = calculateAchievements(donations || []);
    const unlockedAchievements = allAchievements.filter(a => a.unlocked);

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 relative overflow-hidden">
            {/* Background Mesh */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-red-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-orange-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
            </div>

            <main className="relative z-10 w-full max-w-md flex flex-col items-center space-y-8 pb-10">
                {/* Logo */}
                <div className="flex items-center gap-2 mb-2">
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
                        showAchievements={unlockedAchievements.length > 0}
                        achievementCount={unlockedAchievements.length}
                        totalDonations={donationCount}
                        donorNumber={profile.donor_number}
                        badges={unlockedAchievements}  // Pass badges data here
                        className="shadow-xl"
                    />
                </div>

                {/* CTA */}
                <div className="text-center space-y-4 max-w-xs mt-4">
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

            <footer className="absolute bottom-6 text-slate-400 text-xs text-center w-full">
                &copy; {new Date().getFullYear()} Vital App. All rights reserved.
            </footer>
        </div>
    );
}
