import { serviceClient } from '@/lib/supabase-route';
import { SITE_URL } from '@/lib/site';
import { placeLabel } from '@/lib/share';
import { formatBloodGroup } from '@/lib/blood-compatibility';
import { createContactLink } from '@/lib/contact-links';
import { onDonationConfirmed } from '@/lib/donation-events';
import { TEMPLATES, sendButtons, sendTemplate, sendText, waNumber } from '@/lib/whatsapp';

/**
 * Replies to people messaging Vital's WhatsApp number. Inputs are button taps
 * (payloads set when Vital sent the message) and free text.
 *
 *   Donor alert       [I can donate] -> self-check -> offer + contact link
 *                     [Not this time] -> thanks
 *   Offer received    (to requester) -> contact link to the donor
 *   Follow-up         [Yes] -> "type the PIN" -> verify_donation_for()
 *                     [Not yet] -> asked again later; [No] -> request link
 *   Text              STOP / START / LINK / a 4-digit PIN / anything else -> help
 *
 * Every action re-checks the database: a payload only names a request or
 * offer, and the sender's number must belong to the right person.
 */

const DONOR_LINK_MINUTES = 30;
const REQUESTER_LINK_MINUTES = 24 * 60;
const PIN_WAIT_HOURS = 24;

const SELF_CHECK = [
    'I am feeling well today (no cold, flu, sore throat or fever)',
    'No antibiotics in the last 14 days',
    'No tattoo, piercing or surgery in the last 12 months',
    'No alcohol in the last 24 hours',
    'No recent infection (malaria in 3 months, dengue in 6, typhoid in 12)',
];

const HELP = [
    'This is Vital, the free blood donor network.',
    'Reply STOP to stop alerts, START to turn them back on, or LINK for a fresh contact link.',
    `For anything else, visit ${SITE_URL.replace(/^https?:\/\//, '')}`,
].join('\n\n');

const firstName = (full?: string | null) => (full || '').trim().split(/\s+/)[0] || 'there';

type Inbound = { from: string; kind: 'payload' | 'text'; value: string };

export async function handleInbound(msg: Inbound) {
    const from = waNumber(msg.from) ?? msg.from;
    if (msg.kind === 'payload') {
        const [action, id] = msg.value.split(':');
        switch (action) {
            case 'offer': return askSelfCheck(from, id);
            case 'selfok': return makeOffer(from, id);
            case 'selfno': return reply(from, 'Thank you for checking. Please don’t donate today. We’ll keep alerting you for future requests when you’re well.');
            case 'decline': return reply(from, 'No problem, thank you for letting us know. We’ll alert you again when your blood group is needed nearby.');
            case 'fu_yes': return askForPin(from, id);
            case 'fu_later': return followUpLater(from, id);
            case 'fu_no': return followUpNo(from, id);
            default: return reply(from, HELP);
        }
    }

    const text = msg.value.trim();
    const word = text.toUpperCase();
    if (word === 'STOP' || word === 'UNSUBSCRIBE') return setAlerts(from, false);
    if (word === 'START' || word === 'SUBSCRIBE') return setAlerts(from, true);
    if (word === 'LINK') return resendLink(from);
    if (/^\d{4}$/.test(text)) return checkPin(from, text);
    return reply(from, HELP);
}

const reply = (to: string, body: string, ctx: { userId?: string | null; requestId?: string | null; donationId?: string | null } = {}) =>
    sendText(to, body, { kind: 'reply', ...ctx });

async function donorFor(from: string) {
    const admin = serviceClient();
    const { data: id } = await admin.rpc('profile_for_wa', { p_wa: from });
    if (!id) return null;
    const { data } = await admin.from('profiles').select('id, full_name, is_donor').eq('id', id as string).maybeSingle();
    return data;
}

async function openRequest(requestId?: string) {
    if (!requestId || !/^[0-9a-f-]{36}$/i.test(requestId)) return null;
    const { data } = await serviceClient()
        .from('blood_requests')
        .select('id, user_id, blood_group, hospital_name, city, status, date_needed')
        .eq('id', requestId)
        .maybeSingle();
    const open = data && data.status === 'active' && (!data.date_needed || data.date_needed >= new Date().toISOString().slice(0, 10));
    return open ? data : null;
}

async function askSelfCheck(from: string, requestId: string) {
    const donor = await donorFor(from);
    if (!donor?.is_donor) {
        return reply(from, `This number isn’t linked to a Vital donor. Register at ${SITE_URL.replace(/^https?:\/\//, '')}/register with this phone number to get alerts.`);
    }
    const req = await openRequest(requestId);
    if (!req) return reply(from, 'Thank you for wanting to help. This request is no longer open.', { userId: donor.id });

    return sendButtons(from, [
        `Thank you, ${firstName(donor.full_name)}. Before you offer, please check that all of these are true:`,
        SELF_CHECK.map(c => `• ${c}`).join('\n'),
        'The hospital or blood bank makes the final decision on who can donate.',
    ].join('\n\n'), [
        { id: `selfok:${req.id}`, title: 'Yes, all true' },
        { id: `selfno:${req.id}`, title: 'Not today' },
    ], { kind: 'reply', userId: donor.id, requestId: req.id });
}

async function makeOffer(from: string, requestId: string) {
    const admin = serviceClient();
    const donor = await donorFor(from);
    const req = await openRequest(requestId);
    if (!donor?.is_donor || !req) return reply(from, 'This request is no longer open. Thank you for wanting to help.');

    const { data: donationId, error } = await admin.rpc('create_offer_for', { p_donor: donor.id, p_request: req.id });
    if (error || !donationId) {
        const message = error?.message?.includes('Terms')
            ? `Please sign in at ${SITE_URL.replace(/^https?:\/\//, '')} and agree to the Terms and Privacy notice first, then tap the button again.`
            : error?.message?.includes('own request')
                ? 'This is your own request, so you can’t offer on it.'
                : 'Sorry, we couldn’t record your offer. Please try again from the request page.';
        return reply(from, message, { userId: donor.id, requestId: req.id });
    }

    const { url } = await createContactLink(donationId as string, 'donor', DONOR_LINK_MINUTES);
    await reply(from, [
        `Thank you, ${firstName(donor.full_name)}. Your offer is recorded.`,
        `Open this link to see the contact person’s number and your donor PIN. It works for ${DONOR_LINK_MINUTES} minutes:\n${url}`,
        'Call them to arrange the donation. After you donate, give them your PIN so they can confirm it on Vital.',
        'Reply LINK any time for a new link.',
    ].join('\n\n'), { userId: donor.id, requestId: req.id, donationId: donationId as string });

    await tellRequester(req.id, donationId as string, donor.full_name);
}

/** "Asha offered to donate" to the request's contact number, if they asked for updates. */
async function tellRequester(requestId: string, donationId: string, donorName: string | null) {
    const admin = serviceClient();
    const [{ data: contact }, { data: req }] = await Promise.all([
        admin.from('request_contacts').select('contact_phone, whatsapp_updates').eq('request_id', requestId).maybeSingle(),
        admin.from('blood_requests').select('user_id, blood_group, hospital_name, city').eq('id', requestId).maybeSingle(),
    ]);
    const to = contact?.whatsapp_updates ? waNumber(contact.contact_phone) : null;
    if (!to || !req) return;
    const { token } = await createContactLink(donationId, 'requester', REQUESTER_LINK_MINUTES);
    await sendTemplate(to, TEMPLATES.offerReceived, {
        body: [firstName(donorName), formatBloodGroup(req.blood_group), placeLabel(req.hospital_name, req.city) || 'your hospital'],
        urlSuffix: { index: 0, value: token },
    }, { kind: 'offer_received', userId: req.user_id, requestId, donationId });
}

/** The offer, if `from` is the contact number of its request. */
async function offerForRequester(from: string, donationId?: string) {
    if (!donationId || !/^[0-9a-f-]{36}$/i.test(donationId)) return null;
    const admin = serviceClient();
    const { data: d } = await admin
        .from('donations')
        .select('id, status, donor_id, request_id, followup_count')
        .eq('id', donationId)
        .maybeSingle();
    if (!d) return null;
    const [{ data: contact }, { data: donor }] = await Promise.all([
        admin.from('request_contacts').select('contact_phone').eq('request_id', d.request_id).maybeSingle(),
        admin.from('profiles').select('full_name').eq('id', d.donor_id).maybeSingle(),
    ]);
    if (waNumber(contact?.contact_phone) !== from) return null;
    return { ...d, donorFirst: firstName(donor?.full_name) };
}

async function askForPin(from: string, donationId: string) {
    const offer = await offerForRequester(from, donationId);
    if (!offer) return reply(from, HELP);
    if (offer.status !== 'pending') return reply(from, 'This donation has already been confirmed. Thank you!');
    await serviceClient().from('whatsapp_sessions').upsert({
        wa_number: from, awaiting: 'pin', donation_id: offer.id, request_id: offer.request_id,
        expires_at: new Date(Date.now() + PIN_WAIT_HOURS * 3600_000).toISOString(), updated_at: new Date().toISOString(),
    });
    return reply(from, `Wonderful. Please type the 4-digit PIN ${offer.donorFirst} gives you, to confirm the donation.`, { donationId: offer.id, requestId: offer.request_id });
}

async function followUpLater(from: string, donationId: string) {
    const offer = await offerForRequester(from, donationId);
    if (!offer) return reply(from, HELP);
    // The daily follow-up job asks again after a day (up to its limit).
    await serviceClient().from('donations').update({ followup_sent_at: new Date().toISOString() }).eq('id', offer.id);
    return reply(from, 'Okay, we’ll check with you again tomorrow. If they donate before then, you can confirm with their PIN on Vital.', { donationId: offer.id });
}

async function followUpNo(from: string, donationId: string) {
    const offer = await offerForRequester(from, donationId);
    if (!offer) return reply(from, HELP);
    // Stop asking about this offer.
    await serviceClient().from('donations').update({ followup_count: 99, followup_sent_at: new Date().toISOString() }).eq('id', offer.id);
    return reply(from, `Thanks for letting us know. Your request stays open on Vital while it’s needed:\n${SITE_URL}/requests/${offer.request_id}`, { donationId: offer.id });
}

async function checkPin(from: string, pin: string) {
    const admin = serviceClient();
    const { data: session } = await admin.from('whatsapp_sessions').select('*').eq('wa_number', from).maybeSingle();
    if (!session || session.awaiting !== 'pin' || Date.parse(session.expires_at) < Date.now()) {
        return reply(from, 'To confirm a donation, tap “Yes” on our message asking whether they donated, then send the PIN. You can also confirm it in My requests on vitalapp.in.');
    }
    const offer = await offerForRequester(from, session.donation_id);
    const { data: req } = offer
        ? await admin.from('blood_requests').select('user_id').eq('id', offer.request_id).maybeSingle()
        : { data: null };
    if (!offer || !req) {
        await admin.from('whatsapp_sessions').delete().eq('wa_number', from);
        return reply(from, HELP);
    }

    const { data: result, error } = await admin.rpc('verify_donation_for', {
        p_actor: req.user_id, p_donation_id: offer.id, p_pin: pin, p_units: 1,
    });
    if (error) {
        await admin.from('whatsapp_sessions').delete().eq('wa_number', from);
        return reply(from, `${error.message}. You can also manage this in My requests on vitalapp.in.`, { donationId: offer.id });
    }
    const r = result as { error?: string; attempts_left?: number; fulfilled?: boolean; total_collected?: number; units_needed?: number };
    if (r?.error === 'pin_mismatch') {
        const left = Number(r.attempts_left ?? 0);
        if (left === 0) await admin.from('whatsapp_sessions').delete().eq('wa_number', from);
        return reply(from, left > 0
            ? `That PIN doesn’t match. Please check it with ${offer.donorFirst}. ${left} ${left === 1 ? 'try' : 'tries'} left.`
            : 'That PIN doesn’t match, and this offer is now locked. The donor can withdraw and offer again on Vital.', { donationId: offer.id });
    }

    await admin.from('whatsapp_sessions').delete().eq('wa_number', from);
    await reply(from, r?.fulfilled
        ? `Confirmed. Thank you, and thank ${offer.donorFirst}. Your request now has all the units it needs, so it’s closed.`
        : `Confirmed. Thank you, and thank ${offer.donorFirst}. ${r?.total_collected ?? 1} of ${r?.units_needed ?? '?'} units collected; your request stays open for the rest.`,
        { donationId: offer.id, requestId: offer.request_id });
    await onDonationConfirmed(offer.id);
}

async function setAlerts(from: string, on: boolean) {
    const admin = serviceClient();
    const { data: id } = await admin.rpc('profile_for_wa', { p_wa: from });
    if (!id) return reply(from, on ? `Register at ${SITE_URL.replace(/^https?:\/\//, '')}/register to get alerts.` : 'You won’t get alerts from Vital on this number.');
    await admin.from('profiles').update({ whatsapp_alerts: on }).eq('id', id as string);
    return reply(from, on
        ? 'WhatsApp alerts are on. We’ll message you when someone nearby needs your blood group. Reply STOP to turn them off.'
        : 'You won’t get Vital alerts on WhatsApp any more. Reply START to turn them back on, or change it in Settings on vitalapp.in.',
        { userId: id as string });
}

/** A fresh contact link for the newest open offer this number is part of. */
async function resendLink(from: string) {
    const admin = serviceClient();
    const { data: id } = await admin.rpc('profile_for_wa', { p_wa: from });
    if (id) {
        const { data: offer } = await admin.from('donations').select('id, request_id')
            .eq('donor_id', id as string).eq('status', 'pending').order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (offer && await openRequest(offer.request_id)) {
            const { url } = await createContactLink(offer.id, 'donor', DONOR_LINK_MINUTES);
            return reply(from, `Here’s a new link to the contact details and your PIN. It works for ${DONOR_LINK_MINUTES} minutes:\n${url}`, { userId: id as string, donationId: offer.id });
        }
    }
    // Requester: the newest pending offer on a request with this contact number.
    const { data: requestIds } = await admin.rpc('requests_for_contact_wa', { p_wa: from });
    const mine = ((requestIds ?? []) as string[]);
    if (mine.length) {
        const { data: offer } = await admin.from('donations').select('id').in('request_id', mine)
            .eq('status', 'pending').order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (offer) {
            const { url } = await createContactLink(offer.id, 'requester', DONOR_LINK_MINUTES);
            return reply(from, `Here’s a new link to the donor’s contact details. It works for ${DONOR_LINK_MINUTES} minutes:\n${url}`, { donationId: offer.id });
        }
    }
    return reply(from, 'There’s no open offer on this number right now.');
}
