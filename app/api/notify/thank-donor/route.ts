import { NextResponse } from 'next/server';
import { getVerifiedUser, serviceClient } from '@/lib/supabase-route';
import { onDonationConfirmed } from '@/lib/donation-events';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Called by the requester's browser after confirming a donation with the PIN.
 * Sends the donor's thank-you (once) and, if the request is now fulfilled, the
 * "covered" note to other alerted donors. Only the request's owner can trigger
 * it, and only for a completed donation.
 */
export async function POST(request: Request) {
    const { user } = await getVerifiedUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => null);
    const donationId = typeof body?.donationId === 'string' ? body.donationId : '';
    if (!UUID_RE.test(donationId)) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

    const { data: donation } = await serviceClient()
        .from('donations')
        .select('status, blood_requests(user_id)')
        .eq('id', donationId)
        .maybeSingle();
    const req = Array.isArray(donation?.blood_requests) ? donation?.blood_requests[0] : donation?.blood_requests;
    if (!donation || req?.user_id !== user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (donation.status !== 'completed') return NextResponse.json({ error: 'Donation not confirmed' }, { status: 409 });

    try {
        const result = await onDonationConfirmed(donationId);
        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        console.error('Donation confirmed follow-up error', error);
        return NextResponse.json({ error: 'Could not send thank-you' }, { status: 500 });
    }
}
