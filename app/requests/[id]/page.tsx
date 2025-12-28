import { createClient } from '@/utils/supabase/server';
import { notFound } from 'next/navigation';
import { BloodRequestCard } from '@/components/BloodRequestCard';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { id: string } }) {
    const supabase = await createClient();
    const { data: request } = await supabase.from('blood_requests').select('*').eq('id', params.id).single();

    if (!request) {
        return {
            title: 'Request Not Found',
        };
    }

    return {
        title: `${request.blood_group} Blood Needed - Vital`,
        description: `${request.units_needed} units needed at ${request.hospital_name}. Help save a life today.`,
    };
}

export default async function RequestDetailsPage({ params }: { params: { id: string } }) {
    const supabase = await createClient();

    // Fetch request details
    const { data: request } = await supabase
        .from('blood_requests')
        .select('*')
        .eq('id', params.id)
        .single();

    if (!request) {
        return notFound();
    }

    // Check if current user has offered
    const { data: { user } } = await supabase.auth.getUser();
    let hasOffered = false;
    let userBloodGroup = null;

    if (user) {
        const { data: donation } = await supabase
            .from('donations')
            .select('*')
            .eq('request_id', request.id)
            .eq('donor_id', user.id)
            .single();

        hasOffered = !!donation;

        const { data: profile } = await supabase.from('profiles').select('blood_group').eq('id', user.id).single();
        userBloodGroup = profile?.blood_group;
    }

    return (
        <div className="container mx-auto px-4 py-8 max-w-2xl">
            <Link href="/requests" className="text-slate-500 hover:text-red-600 mb-6 inline-block font-medium">
                ← Back to Feed
            </Link>

            <h1 className="text-2xl font-bold mb-6 text-slate-800">Request Details</h1>

            <BloodRequestCard
                request={request}
                hasOffered={hasOffered}
                userBloodGroup={userBloodGroup}
                isOwnRequest={request.requester_id === user?.id}
            // Note: We can add onRespond logic here if we client-side wrap this or make the card handle it. 
            // For now, let's keep it simple for display. 
            // Ideally, BloodRequestCard should be a Client Component or wrapped.
            />

            <div className="mt-8 p-6 bg-slate-50 rounded-xl border border-slate-100 text-center">
                <h3 className="text-lg font-bold text-slate-900 mb-2">Help spread the word</h3>
                <p className="text-slate-600 mb-4">Sharing this link on WhatsApp groups can match this request 5x faster.</p>
            </div>
        </div>
    );
}
