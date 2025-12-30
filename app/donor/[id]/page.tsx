
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import DonorCard from '@/components/DonorCard';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { Lock, Shield, ArrowLeft, Heart } from 'lucide-react';
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
        <div className="min-h-screen bg-slate-50 flex flex-col p-4 relative overflow-hidden">
            {/* Background Mesh */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-red-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-orange-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
            </div>

            {/* Custom Navbar */}
            <header className="relative z-20 w-full max-w-7xl mx-auto flex items-center justify-between py-4 px-2">
                <Link href="/" className="flex items-center gap-2 group">
                    <div className="bg-red-600 rounded-lg p-1.5 transition-transform group-hover:scale-105">
                        <Heart className="w-5 h-5 text-white fill-current" />
                    </div>
                    <span className="text-xl font-bold text-slate-900 tracking-tight">Vital</span>
                </Link>

                <Link href="/register">
                    <Button className="bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-100 rounded-full px-6">
                        Become a Donor
                    </Button>
                </Link>
            </header>

            {/* Main Content - Centered Card Only */}
            <main className="flex-grow flex items-center justify-center relative z-10 w-full py-10">
                <div className="w-full max-w-sm transform transition-all duration-500 hover:scale-[1.01]">
                    <DonorCard
                        user={profile}
                        showAchievements={unlockedAchievements.length > 0}
                        achievementCount={unlockedAchievements.length}
                        totalDonations={donationCount}
                        donorNumber={profile.donor_number}
                        badges={unlockedAchievements}
                        className="shadow-2xl shadow-slate-200/50"
                    />
                </div>
            </main>

            <footer className="relative z-10 text-center text-slate-400 text-xs py-6">
                &copy; {new Date().getFullYear()} Vital App. All rights reserved.
            </footer>
        </div>
    );
}
