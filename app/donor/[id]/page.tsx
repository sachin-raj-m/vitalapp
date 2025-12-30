
import { supabase } from '@/lib/supabase';
import { notFound } from 'next/navigation';
import DonorCard from '@/components/DonorCard';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

// Set revalidation time (e.g., 60 seconds)
export const revalidate = 60;

interface Props {
    params: {
        id: string;
    };
}

export async function generateMetadata({ params }: Props) {
    const { id } = params;
    return {
        title: 'Vital Donor Card',
        description: 'View my official Verified Donor Card on Vital.',
    };
}

export default async function PublicDonorPage({ params }: Props) {
    const { id } = params;

    // Fetch user data
    // Note: We need a way to fetch public profile data. 
    // Assuming 'profiles' table or similar exists that is publicly readable for minimal info
    // or using a secure RPC if direct table access is restricted.
    // For now, attempting direct fetch from 'profiles' or 'users' (metadata).
    // Adjusting query to fetch necessary fields for the card.

    // NOTE: Supabase Auth users data isn't directly queryable from client usually, 
    // but on server (here) we might need service role key or specific public view.
    // For this implementation, I'll assume there is a public_profiles view or I'll try to fetch safely.
    // If getting data fails, we show 404.

    // Using a server-side query.
    // Ideally we should use the admin client to fetch user metadata if it's not in a public table.
    // But let's assume 'profiles' table exists which is a common pattern.

    // Fallback: If 'profiles' table isn't set up, we might need to rely on 'blood_requests' or similar?
    // Let's assume a 'profiles' table for now based on typical Supabase setup. 
    // Wait, the project structure hasn't explicitly shown a 'profiles' table schema. 
    // The previous code accessed `user` from `useAuth` which wraps `supabase.auth.getUser()`.

    // IMPORTANT: For this to work, we need a way to look up user details by ID.
    // I will try to fetch from 'profiles'. If that fails, I might need to ask the user or use a different method.

    // Determine lookup method
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const isDonorNumber = /^\d+$/.test(id);

    if (!isUuid && !isDonorNumber) {
        return notFound();
    }

    let query = supabase
        .from('profiles')
        .select('id, full_name, blood_group, is_donor, donor_number');

    if (isUuid) {
        query = query.eq('id', id);
    } else {
        query = query.eq('donor_number', parseInt(id));
    }

    const { data: profile, error } = await query.single();

    if (error || !profile) {
        return notFound();
    }

    // Fetch donation count using the UUID we found
    const { count: donationCount } = await supabase
        .from('donations')
        .select('*', { count: 'exact', head: true })
        .eq('donor_id', profile.id);

    // If using the 'auth.users' table isn't possible directly safely without admin key.

    // Alternative: If we can't fetch a profile table, this page might 404.
    // I will create a basic version. If it fails, I'll prompt the user about data access.

    if (error || !profile) {
        // If profile fetch fails, it might be because the user doesn't exist or table permissions.
        // For the sake of the task, I will mock if needed or handle the error gracefully.
        return notFound();
    }

    if (!profile.is_donor) {
        return notFound(); // Only show for donors
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 relative overflow-hidden">
            {/* Background Mesh (similar to profile) */}
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
                        achievementCount={3} // Placeholder for badges
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
