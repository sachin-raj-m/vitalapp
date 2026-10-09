import { NextResponse } from 'next/server';
import { getDonorThankYouEmailHtml } from '@/lib/email-templates';
import { sendEmail } from '@/lib/email';
import { getVerifiedUser, serviceClient } from '@/lib/supabase-route';
import { rateLimit } from '@/lib/rate-limit';
import { SITE_URL } from '@/lib/site';
import { placeLabel } from '@/lib/share';
import { referralPath } from '@/lib/referrals';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Thank-you email to a donor after the requester confirmed their donation with
 * the PIN. Only the requester who owns the request can trigger it, only for a
 * completed donation, and only once per donation.
 */
export async function POST(request: Request) {
    const { user } = await getVerifiedUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => null);
    const donationId = typeof body?.donationId === 'string' ? body.donationId : '';
    if (!UUID_RE.test(donationId)) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

    const admin = serviceClient();
    const { data: donation } = await admin
        .from('donations')
        .select('id, status, donor_id, blood_requests(user_id, hospital_name, city)')
        .eq('id', donationId)
        .maybeSingle();
    const req = Array.isArray(donation?.blood_requests) ? donation?.blood_requests[0] : donation?.blood_requests;
    if (!donation || req?.user_id !== user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (donation.status !== 'completed') return NextResponse.json({ error: 'Donation not confirmed' }, { status: 409 });

    // Once per donation (the window is far longer than any retry).
    if (!(await rateLimit(`thank-donor:${donationId}`, 60 * 60 * 24 * 365, 1))) {
        return NextResponse.json({ success: true, skipped: true });
    }

    const { data: donor } = await admin.from('profiles').select('email, full_name').eq('id', donation.donor_id).maybeSingle();
    if (!donor?.email) return NextResponse.json({ success: true, skipped: true });

    const { data: code } = await admin.rpc('ensure_referral_code', { p_user: donation.donor_id });
    const firstName = (donor.full_name || '').trim().split(/\s+/)[0] || 'there';

    try {
        await sendEmail({
            to: donor.email,
            subject: `Thank you, ${firstName}`,
            html: getDonorThankYouEmailHtml({
                name: firstName,
                place: placeLabel(req?.hospital_name, req?.city),
                referralLink: typeof code === 'string' && code ? `${SITE_URL}${referralPath(code)}` : null,
            }),
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Thank-you email error', error);
        return NextResponse.json({ error: 'Could not send email' }, { status: 500 });
    }
}
