import { serviceClient } from '@/lib/supabase-route';
import { rateLimit } from '@/lib/rate-limit';
import { sendEmail } from '@/lib/email';
import { getDonorThankYouEmailHtml } from '@/lib/email-templates';
import { SITE_URL } from '@/lib/site';
import { placeLabel } from '@/lib/share';
import { referralPath } from '@/lib/referrals';
import { formatBloodGroup } from '@/lib/blood-compatibility';
import { TEMPLATES, sendTemplate, waNumber } from '@/lib/whatsapp';

const firstName = (full?: string | null) => (full || '').trim().split(/\s+/)[0] || 'there';

/**
 * After a donation is confirmed with the donor's PIN (on the web or in
 * WhatsApp): thank the donor once, by email and (if they opted in) WhatsApp,
 * with their invite link. If that completed the request, tell the other donors
 * who were alerted for it on WhatsApp that it's covered.
 *
 * Callers must have checked that the confirmation was legitimate.
 */
export async function onDonationConfirmed(donationId: string) {
    const admin = serviceClient();
    const { data: donation } = await admin
        .from('donations')
        .select('id, status, donor_id, request_id, blood_requests(id, status, blood_group, hospital_name, city)')
        .eq('id', donationId)
        .maybeSingle();
    if (!donation || donation.status !== 'completed') return { thanked: false };
    const req = (Array.isArray(donation.blood_requests) ? donation.blood_requests[0] : donation.blood_requests) as
        { id: string; status: string; blood_group: string; hospital_name: string | null; city: string | null } | null;
    const place = placeLabel(req?.hospital_name, req?.city);

    let thanked = false;
    // Once per donation, however many times this is called.
    if (await rateLimit(`thank-donor:${donationId}`, 60 * 60 * 24 * 365, 1)) {
        const { data: donor } = await admin
            .from('profiles')
            .select('email, full_name, phone, whatsapp_alerts')
            .eq('id', donation.donor_id)
            .maybeSingle();
        const { data: code } = await admin.rpc('ensure_referral_code', { p_user: donation.donor_id });
        const inviteLink = typeof code === 'string' && code ? `${SITE_URL}${referralPath(code)}` : null;
        const name = firstName(donor?.full_name);

        const jobs: Promise<unknown>[] = [];
        if (donor?.email) {
            jobs.push(sendEmail({
                to: donor.email,
                subject: `Thank you, ${name}`,
                html: getDonorThankYouEmailHtml({ name, place, referralLink: inviteLink }),
            }));
        }
        const wa = donor?.whatsapp_alerts ? waNumber(donor.phone) : null;
        if (wa) {
            jobs.push(sendTemplate(wa, TEMPLATES.donorThanks, {
                body: [name, place || 'the hospital', inviteLink ? inviteLink.replace(/^https?:\/\//, '') : 'vitalapp.in'],
            }, { kind: 'thanks', userId: donation.donor_id, requestId: donation.request_id, donationId }));
        }
        const results = await Promise.allSettled(jobs);
        thanked = results.some(r => r.status === 'fulfilled');
        results.forEach(r => { if (r.status === 'rejected') console.error('Thank-you send failed', r.reason); });
    }

    if (req?.status === 'fulfilled') await notifyRequestCovered(req.id, req.blood_group, place);
    return { thanked };
}

/** Tells WhatsApp-alerted donors who didn't donate that a request is covered. Once per request. */
async function notifyRequestCovered(requestId: string, bloodGroup: string, place: string) {
    if (!(await rateLimit(`request-covered:${requestId}`, 60 * 60 * 24 * 365, 1))) return;
    const admin = serviceClient();
    const [{ data: alerted }, { data: donated }] = await Promise.all([
        admin.from('whatsapp_messages').select('user_id, wa_number').eq('request_id', requestId).eq('kind', 'alert').neq('status', 'failed'),
        admin.from('donations').select('donor_id').eq('request_id', requestId).eq('status', 'completed'),
    ]);
    const skip = new Set((donated ?? []).map(d => d.donor_id));
    const seen = new Set<string>();
    const targets = (alerted ?? []).filter(a => a.user_id && !skip.has(a.user_id) && !seen.has(a.wa_number) && seen.add(a.wa_number));
    if (!targets.length) return;

    // Respect opt-outs made since the alert went out.
    const { data: still } = await admin.from('profiles').select('id').in('id', targets.map(t => t.user_id!)).eq('whatsapp_alerts', true);
    const optedIn = new Set((still ?? []).map(p => p.id));
    await Promise.allSettled(targets.filter(t => optedIn.has(t.user_id!)).map(t =>
        sendTemplate(t.wa_number, TEMPLATES.requestCovered, { body: [formatBloodGroup(bloodGroup), place || 'the hospital'] },
            { kind: 'covered', userId: t.user_id, requestId }),
    ));
}
