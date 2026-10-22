import { serviceClient } from '@/lib/supabase-route';
import { SITE_URL } from '@/lib/site';
import { placeLabel } from '@/lib/share';
import { formatBloodGroup } from '@/lib/blood-compatibility';
import { createContactLink } from '@/lib/contact-links';
import { onDonationConfirmed } from '@/lib/donation-events';
import { TEMPLATES, sendButtons, sendTemplate, sendText, waNumber } from '@/lib/whatsapp';
import { PHONE_CODE_MAX_ATTEMPTS, PHONE_PURPOSE, parseVerifyMessage, phoneCodeHash } from '@/lib/phone-verification';
import { PHONE_LOGIN_MAX_DELIVERIES, decryptCode, isLoginMessage, loginCodeMessage } from '@/lib/phone-login';

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
 *                     VERIFY <6-digit code> -> verifies the sender's number
 *                     (the code comes from registration or Settings)
 *                     LOGIN -> the sign-in code waiting for the sender's number
 *                     ("Continue with WhatsApp", lib/phone-login.ts)
 *
 * Every action re-checks the database: a payload only names a request or
 * offer, and the sender's number must belong to the right person.
 */

const DONOR_LINK_MINUTES = 30;
const REQUESTER_LINK_MINUTES = 30;
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

const VERIFY_HELP = `That code isn’t right or has expired. In Settings on ${SITE_URL.replace(/^https?:\/\//, '')}, tap “Verify on WhatsApp” for a new one and send it from the number on your profile.`;

const firstName = (full?: string | null) => (full || '').trim().split(/\s+/)[0] || 'there';

type Inbound = { from: string; kind: 'payload' | 'text'; value: string };

export async function handleInbound(msg: Inbound) {
    const from = waNumber(msg.from) ?? msg.from;
    if (msg.kind === 'payload') {
        const [action, id, extra] = msg.value.split(':');
        switch (action) {
            case 'offer': return askSelfCheck(from, id);
            case 'selfok': return makeOffer(from, id);
            case 'selfno': return reply(from, 'Thank you for checking. Please don’t donate today. We’ll keep alerting you for future requests when you’re well.');
            case 'decline': return reply(from, 'No problem, thank you for letting us know. We’ll alert you again when your blood group is needed nearby.');
            case 'contact': return sendRequesterContact(from, id);
            case 'done': return askUnits(from, id);
            case 'units': return askForPin(from, id, Number(extra));
            case 'fu_yes': return askUnits(from, id);
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
    const verifyCode = parseVerifyMessage(text);
    if (verifyCode) return verifyNumber(from, verifyCode);
    if (/^VERIFY\b/.test(word)) return reply(from, VERIFY_HELP);
    if (isLoginMessage(text)) return sendLoginCode(from);
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
        `Open this link to see the contact person’s number and the PIN for this offer. It works for ${DONOR_LINK_MINUTES} minutes:\n${url}`,
        'Call them to arrange the donation. After you donate, give them this PIN so they can confirm it on Vital. It works only for this offer.',
        'Reply LINK any time for a new link.',
    ].join('\n\n'), { userId: donor.id, requestId: req.id, donationId: donationId as string });

    await tellRequester(req.id, donationId as string);
}

/**
 * "New response to your request" to the request's contact number, if they asked
 * for updates. The template names nobody (Meta rejects templates about another
 * person's offer as Utility); tapping "View details" gets the donor's name and a
 * private contact link as a free reply (sendRequesterContact).
 */
async function tellRequester(requestId: string, donationId: string) {
    const admin = serviceClient();
    const [{ data: contact }, { data: req }] = await Promise.all([
        admin.from('request_contacts').select('contact_phone, whatsapp_updates').eq('request_id', requestId).maybeSingle(),
        admin.from('blood_requests').select('user_id, blood_group, hospital_name, city').eq('id', requestId).maybeSingle(),
    ]);
    const to = contact?.whatsapp_updates ? waNumber(contact.contact_phone) : null;
    if (!to || !req) return;
    await sendTemplate(to, TEMPLATES.requestResponse, {
        body: [formatBloodGroup(req.blood_group), placeLabel(req.hospital_name, req.city) || 'your hospital'],
        quickReplies: [`contact:${donationId}`],
    }, { kind: 'offer_received', userId: req.user_id, requestId, donationId });
}

/** After "View details": who offered, plus a private link to their number. */
async function sendRequesterContact(from: string, donationId: string) {
    const offer = await offerForRequester(from, donationId);
    if (!offer) return reply(from, HELP);
    if (offer.status !== 'pending') return reply(from, 'This offer is no longer open. Check My requests on Vital for the latest.', { donationId: offer.id });
    const { url } = await createContactLink(offer.id, 'requester', REQUESTER_LINK_MINUTES);
    return sendButtons(from, [
        `${offer.donorFirst} has offered to donate.`,
        `Open this private link to see their number. It works for ${REQUESTER_LINK_MINUTES} minutes:\n${url}`,
        `Call them to arrange the donation. After they donate, tap the button below and have their 4-digit PIN ready.`,
    ].join('\n\n'), [{ id: `done:${offer.id}`, title: 'They have donated' }],
    { kind: 'reply', donationId: offer.id, requestId: offer.request_id });
}

/** Units the request still needs (0 if complete). */
async function remainingUnits(requestId: string) {
    const admin = serviceClient();
    const [{ data: req }, { data: done }] = await Promise.all([
        admin.from('blood_requests').select('units_needed').eq('id', requestId).maybeSingle(),
        admin.from('donations').select('units_donated').eq('request_id', requestId).eq('status', 'completed'),
    ]);
    const collected = (done ?? []).reduce((sum, d) => sum + (Number(d.units_donated) || 0), 0);
    return Math.max(0, (req?.units_needed ?? 0) - collected);
}

/** "How many units did Asha donate?" (skipped when only one unit is left). */
async function askUnits(from: string, donationId: string) {
    const offer = await offerForRequester(from, donationId);
    if (!offer) return reply(from, HELP);
    if (offer.status !== 'pending') return reply(from, 'This donation has already been confirmed. Thank you!');
    const remaining = await remainingUnits(offer.request_id);
    if (remaining === 0) return reply(from, 'Your request already has all the units it needs. You can check it in My requests on Vital.', { donationId: offer.id });
    if (remaining === 1) return askForPin(from, offer.id, 1);
    const options = Array.from({ length: Math.min(remaining, 3) }, (_, i) => i + 1);
    return sendButtons(from, `How many units did ${offer.donorFirst} donate? Most donors give 1 unit.`,
        options.map(n => ({ id: `units:${offer.id}:${n}`, title: n === 1 ? '1 unit' : `${n} units` })),
        { kind: 'reply', donationId: offer.id, requestId: offer.request_id });
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

async function askForPin(from: string, donationId: string, units: number) {
    const offer = await offerForRequester(from, donationId);
    if (!offer) return reply(from, HELP);
    if (offer.status !== 'pending') return reply(from, 'This donation has already been confirmed. Thank you!');
    const remaining = await remainingUnits(offer.request_id);
    if (!Number.isInteger(units) || units < 1 || units > Math.max(remaining, 1)) {
        return reply(from, `Please choose between 1 and ${Math.max(remaining, 1)} units.`, { donationId: offer.id });
    }
    await serviceClient().from('whatsapp_sessions').upsert({
        wa_number: from, awaiting: 'pin', donation_id: offer.id, request_id: offer.request_id, units,
        expires_at: new Date(Date.now() + PIN_WAIT_HOURS * 3600_000).toISOString(), updated_at: new Date().toISOString(),
    });
    return reply(from, `Thank you. Please type the 4-digit PIN ${offer.donorFirst} gives you, to confirm ${units === 1 ? '1 unit' : `${units} units`}.`, { donationId: offer.id, requestId: offer.request_id });
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
        return reply(from, 'To confirm a donation, tap “They have donated” (or “Yes” on our follow-up), choose the units, then send the PIN. You can also confirm it in My requests on Vital.');
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
        p_actor: req.user_id, p_donation_id: offer.id, p_pin: pin, p_units: session.units ?? 1,
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
            return reply(from, `Here’s a new link to the contact details and the PIN for this offer. It works for ${DONOR_LINK_MINUTES} minutes:\n${url}`, { userId: id as string, donationId: offer.id });
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

/**
 * "VERIFY 123456". Codes are looked up by the number they were made for, so a
 * code only works when sent from the number on that profile; confirm_phone_for()
 * re-checks the profile's current number and releases it from other accounts.
 */
async function verifyNumber(from: string, code: string) {
    const admin = serviceClient();
    const { data: rows } = await admin.from('verification_codes')
        .select('user_id, code_hash, attempts, expires_at')
        .eq('purpose', PHONE_PURPOSE)
        .eq('payload->>wa', from);
    const live = (rows ?? []).filter(r => Date.parse(r.expires_at) > Date.now() && r.attempts < PHONE_CODE_MAX_ATTEMPTS);
    const match = live.find(r => phoneCodeHash(r.user_id, code) === r.code_hash);
    if (!match) {
        await Promise.all(live.map(r => admin.from('verification_codes')
            .update({ attempts: r.attempts + 1 }).eq('user_id', r.user_id).eq('purpose', PHONE_PURPOSE)));
        return reply(from, VERIFY_HELP);
    }

    const { data: result, error } = await admin.rpc('confirm_phone_for', { p_user: match.user_id, p_wa: from });
    if (error) {
        console.error('Phone verification failed', error.message);
        return reply(from, 'Sorry, we couldn’t verify your number just now. Please try again in a minute.', { userId: match.user_id });
    }
    switch (result as string) {
        case 'verified':
        case 'already_verified':
            return reply(from, 'Your number is verified. Thank you! You can go back to Vital now.', { userId: match.user_id });
        case 'taken':
            return reply(from, 'This number is already registered to another Vital account. Sign in to that account, or contact Vital if the number is yours.', { userId: match.user_id });
        default:
            return reply(from, 'The number on your Vital profile isn’t this one. Check it in Settings, then tap “Verify on WhatsApp” again.', { userId: match.user_id });
    }
}

/**
 * "LOGIN": the sign-in code Supabase made for this number (stored by the Send
 * SMS hook, app/api/auth/send-sms). WhatsApp says who sent the message, so the
 * code only ever goes to the number it was made for.
 */
async function sendLoginCode(from: string) {
    const admin = serviceClient();
    const { data: row } = await admin.from('phone_login_codes')
        .select('user_id, code_enc, expires_at, deliveries')
        .eq('wa_number', from)
        .maybeSingle();
    const site = SITE_URL.replace(/^https?:\/\//, '');
    if (!row || Date.parse(row.expires_at) < Date.now()) {
        if (row) await admin.from('phone_login_codes').delete().eq('wa_number', from);
        return reply(from, `No sign-in code is waiting for this number. On ${site}, tap “Continue with WhatsApp”, enter this number, then send LOGIN again.`);
    }
    if (row.deliveries >= PHONE_LOGIN_MAX_DELIVERIES) {
        return reply(from, `We’ve already sent this code several times. Scroll up in this chat to find it, or ask for a new code on ${site}.`, { userId: row.user_id });
    }
    const code = decryptCode(row.code_enc);
    if (!code) return reply(from, `Sorry, we couldn’t read your code. Please ask for a new one on ${site}.`);
    await admin.from('phone_login_codes')
        .update({ deliveries: row.deliveries + 1, delivered_at: new Date().toISOString() })
        .eq('wa_number', from);
    return reply(from, loginCodeMessage(code), { userId: row.user_id });
}
