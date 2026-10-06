import { NextResponse } from 'next/server';
import { getVerifiedUser, serviceClient } from '@/lib/supabase-route';

/**
 * Deletes the caller's account and everything tied to it. The user is verified
 * with getUser() (a forged session cookie must never reach the service role).
 */
export async function POST(request: Request) {
    const { user } = await getVerifiedUser(request);
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = serviceClient();
    const userId = user.id;

    try {
        // Children first, so foreign keys don't block the profile delete.
        const { data: ownRequests } = await admin.from('blood_requests').select('id').eq('user_id', userId);
        const requestIds = (ownRequests || []).map(r => r.id);
        if (requestIds.length) {
            await admin.from('donations').delete().in('request_id', requestIds);
            await admin.from('request_contacts').delete().in('request_id', requestIds);
            await admin.from('blood_requests').delete().in('id', requestIds);
        }
        await admin.from('donations').delete().eq('donor_id', userId);
        await admin.from('push_subscriptions').delete().eq('user_id', userId);
        await admin.from('notifications').delete().eq('user_id', userId);
        await admin.from('donor_secrets').delete().eq('user_id', userId);

        const { error: profileError } = await admin.from('profiles').delete().eq('id', userId);
        if (profileError) throw profileError;

        const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
        if (deleteError) throw deleteError;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting account:', error);
        return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
    }
}
