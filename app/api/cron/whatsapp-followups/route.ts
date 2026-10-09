import { NextResponse } from 'next/server';
import { serviceClient } from '@/lib/supabase-route';
import { TEMPLATES, sendTemplate, waNumber, whatsappEnabled } from '@/lib/whatsapp';
import { formatBloodGroup } from '@/lib/blood-compatibility';
import { placeLabel } from '@/lib/share';

export const dynamic = 'force-dynamic';

const MIN_OFFER_AGE_HOURS = 12;   // give people time to meet first
const REASK_AFTER_HOURS = 20;     // roughly once a day (the job runs daily)
const MAX_FOLLOWUPS = 3;

/**
 * Daily (vercel.json crons): asks requesters on WhatsApp whether pending offers
 * turned into donations: [Yes] -> PIN in chat, [Not yet] -> asked again, [No].
 * Only for requests whose contact asked for WhatsApp updates. Vercel calls it
 * with "Authorization: Bearer $CRON_SECRET".
 */
export async function GET(request: Request) {
    const secret = process.env.CRON_SECRET;
    if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!whatsappEnabled()) return NextResponse.json({ skipped: 'whatsapp disabled' });

    const admin = serviceClient();
    const now = Date.now();
    const { data: offers, error } = await admin
        .from('donations')
        .select('id, donor_id, request_id, followup_count, followup_sent_at')
        .eq('status', 'pending')
        .lt('followup_count', MAX_FOLLOWUPS)
        .lt('created_at', new Date(now - MIN_OFFER_AGE_HOURS * 3600_000).toISOString())
        .or(`followup_sent_at.is.null,followup_sent_at.lt.${new Date(now - REASK_AFTER_HOURS * 3600_000).toISOString()}`)
        .limit(200);
    if (error) return NextResponse.json({ error: 'query failed' }, { status: 500 });

    let sent = 0;
    for (const offer of offers ?? []) {
        const [{ data: req }, { data: contact }, { data: donor }] = await Promise.all([
            admin.from('blood_requests').select('user_id, blood_group, hospital_name, city, status').eq('id', offer.request_id).maybeSingle(),
            admin.from('request_contacts').select('contact_phone, whatsapp_updates').eq('request_id', offer.request_id).maybeSingle(),
            admin.from('profiles').select('full_name').eq('id', offer.donor_id).maybeSingle(),
        ]);
        const to = contact?.whatsapp_updates ? waNumber(contact.contact_phone) : null;
        if (!req || req.status !== 'active' || !to) continue;

        const first = (donor?.full_name || '').trim().split(/\s+/)[0] || 'The donor';
        const id = await sendTemplate(to, TEMPLATES.donationFollowup, {
            body: [first, formatBloodGroup(req.blood_group), placeLabel(req.hospital_name, req.city) || 'the hospital'],
            quickReplies: [`fu_yes:${offer.id}`, `fu_later:${offer.id}`, `fu_no:${offer.id}`],
        }, { kind: 'followup', userId: req.user_id, requestId: offer.request_id, donationId: offer.id });

        await admin.from('donations')
            .update({ followup_sent_at: new Date().toISOString(), followup_count: offer.followup_count + 1 })
            .eq('id', offer.id);
        if (id) sent++;
    }
    return NextResponse.json({ checked: offers?.length ?? 0, sent });
}
