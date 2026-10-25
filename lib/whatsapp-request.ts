import { serviceClient } from '@/lib/supabase-route';
import { SITE_URL } from '@/lib/site';
import { formatBloodGroup } from '@/lib/blood-compatibility';
import { PLATFORM_DISCLAIMER, consentStamp, earliestConsentAt, hasRecordedConsent } from '@/lib/legal';
import { formatWaNumber } from '@/lib/phone';
import { rateLimit } from '@/lib/rate-limit';
import { distanceKm, insideIndia } from '@/lib/location';
import { searchPlaces, type Place } from '@/lib/nominatim';
import { locateCity, locatePin, type Area } from '@/lib/pin-geocode';
import { ALERT_REQUEST_COLUMNS, alertDonors, type AlertableRequest } from '@/lib/donor-alerts';
import { MATCH_RADIUS_KM } from '@/lib/geo';
import { sendButtons, sendList, sendText, waNumber } from '@/lib/whatsapp';
import {
    BLOOD_GROUP_CHOICES, MAX_DAYS_AHEAD, MAX_UNITS, addDays, answerContact, confirmingContact, contactLine, dateQuestion,
    draftFromFirstMessage, indiaToday, isRequestCommand, nextStep, neededByLabel, parseBloodGroup, parseHospitalAnswer, parseMobile,
    parseName, parseNeededBy, parseUnits, placeNeedsTown, urgencyFor,
    type PlaceMatch, type RequestDraft, type RequestStep,
} from '@/lib/whatsapp-request-parse';

/**
 * Posting a blood request over WhatsApp. Server only.
 *
 *   "need O+ blood, 2 units at Medical College Kozhikode"   (or REQUEST, or the
 *   "Request blood" button under the help reply, or a forwarded post with
 *   "Blood Group : AB +ve" / "Hospital : ..." / "Bystander Name and Contact:" lines)
 *     -> what the message already says is kept; the rest is asked one question
 *        at a time: blood group (list) -> units (list, or typed) -> hospital +
 *        town or PIN (geocoded here; a lone name like "Jubilee Hospital" asks
 *        for its town) -> needed by [Today] [Tomorrow] [Another date] (saying
 *        so when the message's date has passed) -> contact name [Use <profile
 *        name>] -> contact number [Use this number]; a contact taken from the
 *        message is confirmed instead: [Use this] [Change]
 *     -> summary with the Terms/Privacy line: [Post request] [Edit] [Cancel]
 *     -> on Post: the sender's account (found by the number, or created with
 *        the number confirmed: WhatsApp itself proves it), the request and its
 *        contact, donor alerts (lib/donor-alerts.ts), then the share link.
 *
 * Nothing is written to blood_requests before [Post request]. The draft lives
 * in whatsapp_sessions (awaiting = 'request') and expires after 30 minutes of
 * silence. At most MAX_REQUESTS_PER_DAY posts per number per 24 hours.
 * Switched on by WHATSAPP_ENABLED=true and WHATSAPP_REQUESTS=true; otherwise
 * the bot points people to the web form.
 *
 * Payload ids: rq:start, rq:bg:<group>, rq:units:<n>, rq:date:today|tomorrow|pick,
 * rq:name:me, rq:phone:me, rq:contact:use|change, rq:post, rq:edit, rq:cancel,
 * rq:field:<step>.
 */

export const requestsEnabled = () => process.env.WHATSAPP_ENABLED === 'true' && process.env.WHATSAPP_REQUESTS === 'true';

export const SESSION_MINUTES = 30;
export const MAX_REQUESTS_PER_DAY = 3;
// A match for the hospital this far from its PIN area's centre is a different place with the same name.
const MAX_MATCH_FROM_PIN_KM = 40;

const SITE = SITE_URL.replace(/^https?:\/\//, '');
export const WEB_FORM_MESSAGE = `To post a blood request, fill in the short form at ${SITE_URL}/requests/new. Donors nearby are alerted as soon as it's posted.`;
const EXPIRED = 'There’s no request waiting to be posted from this number: it was already posted, cancelled, or the draft expired after 30 minutes without a reply. Send REQUEST to start a new one.';
const CANCELLED = 'Cancelled. Nothing was posted. Send REQUEST whenever you need to post a blood request.';
const SORRY = 'Sorry, we couldn’t post your request just now. Please tap “Post request” again in a minute.';

type Ctx = { userId?: string | null; requestId?: string | null };
const say = (to: string, body: string, ctx: Ctx = {}) => sendText(to, body, { kind: 'request_flow', ...ctx });

type Session = { step: RequestStep; draft: RequestDraft };

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

/** The request being drafted on this number, 'expired' (and cleared), or null. */
export async function requestSession(from: string): Promise<Session | 'expired' | null> {
    const admin = serviceClient();
    const { data } = await admin.from('whatsapp_sessions').select('awaiting, step, draft, expires_at').eq('wa_number', from).maybeSingle();
    if (!data || data.awaiting !== 'request') return null;
    if (Date.parse(data.expires_at) < Date.now()) {
        await admin.from('whatsapp_sessions').delete().eq('wa_number', from).eq('awaiting', 'request');
        return 'expired';
    }
    return { step: data.step as RequestStep, draft: (data.draft ?? {}) as RequestDraft };
}

async function save(from: string, step: RequestStep, draft: RequestDraft) {
    const { error } = await serviceClient().from('whatsapp_sessions').upsert({
        wa_number: from, awaiting: 'request', step, draft, donation_id: null, request_id: null, units: null,
        expires_at: new Date(Date.now() + SESSION_MINUTES * 60_000).toISOString(), updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(`whatsapp request session: ${error.message}`);
}

async function postedToday(from: string): Promise<number> {
    const { data } = await serviceClient().rpc('wa_requests_posted_today', { p_wa: from });
    return Number(data ?? 0);
}

/** The account that has proven this number (never someone who only typed it). */
async function provenAccount(from: string): Promise<string | null> {
    const { data } = await serviceClient().rpc('wa_account_for', { p_wa: from });
    return (data as string | null) ?? null;
}

// ---------------------------------------------------------------------------
// Entry points (called from lib/whatsapp-bot.ts)
// ---------------------------------------------------------------------------

/** A message asking for blood, REQUEST, or the "Request blood" button. */
export async function startRequest(from: string, text: string) {
    if (!requestsEnabled()) return say(from, WEB_FORM_MESSAGE);

    const current = await requestSession(from);
    if (current && current !== 'expired') {
        // One request at a time: carry on with the one in progress.
        return ask(from, current.step, current.draft, ['You’re already posting a request. Let’s finish it first (or reply CANCEL to stop it).']);
    }
    if (await postedToday(from) >= MAX_REQUESTS_PER_DAY) {
        return say(from, `You’ve posted ${MAX_REQUESTS_PER_DAY} requests from this number in the last 24 hours, which is the limit on WhatsApp. To post another, use ${SITE_URL}/requests/new. Manage your requests in My requests on ${SITE}.`);
    }
    if (!(await rateLimit(`wa-request-start:${from}`, 60 * 60, 10))) {
        return say(from, `Too many new requests from this number in the last hour. Please try again later, or use ${SITE_URL}/requests/new.`);
    }

    // A forwarded post's contact is confirmed before the summary; a date in it that has passed is said so.
    const draft = draftFromFirstMessage(text.slice(0, 1000), indiaToday());
    const accountId = await provenAccount(from);
    if (accountId) {
        const { data: profile } = await serviceClient().from('profiles').select('full_name').eq('id', accountId).maybeSingle();
        draft.profileName = parseName(profile?.full_name ?? '') ?? null;
    }
    const known = describe(draft);
    return advance(from, draft, [
        'Let’s post your blood request on Vital. I’ll ask a few quick questions; nothing is posted until you confirm. Reply CANCEL any time to stop.',
        ...(known ? [`So far: ${known}`] : []),
    ]);
}

/** CANCEL while drafting. */
export async function cancelRequest(from: string) {
    await serviceClient().from('whatsapp_sessions').delete().eq('wa_number', from).eq('awaiting', 'request');
    return say(from, CANCELLED);
}

/** A typed answer while a request is being drafted. */
export async function answerRequest(from: string, session: Session, text: string) {
    const { step } = session;
    const draft = { ...session.draft };
    const t = text.trim().slice(0, 300);
    const today = indiaToday();

    if (isRequestCommand(t)) {
        return ask(from, step, draft, ['You’re already posting a request. Answer the question below, or reply CANCEL to stop it.']);
    }

    switch (step) {
        case 'blood_group': {
            const group = parseBloodGroup(t);
            if (!group) {
                const unsure = /(?<![a-z])(don'?t know|dont know|not sure|unknown|no idea)(?![a-z])/i.test(t);
                return ask(from, step, draft, [unsure
                    ? 'The hospital or blood bank can tell you the patient’s blood group. Once you know it, choose it below.'
                    : 'Please choose the blood group from the list, or type it like O+ or B negative.']);
            }
            draft.bloodGroup = group;
            break;
        }
        case 'units': {
            const units = parseUnits(t, true);
            if (!units) return ask(from, step, draft, [`Please send a number from 1 to ${MAX_UNITS}.`]);
            draft.units = units;
            break;
        }
        case 'hospital': {
            const answer = parseHospitalAnswer(t);
            if (!answer) return ask(from, step, draft, ['Please send the hospital’s name and town (no links), or its 6-digit PIN code.']);
            const waitingForTown = !!draft.hospital && !draft.place;
            if (!answer.hospital) {
                // Just a PIN: keep a name we already have, else ask for it.
                draft.pin = answer.pin;
                draft.place = undefined;
                if (!draft.hospital) {
                    await save(from, 'hospital', draft);
                    return say(from, `Thanks. And the hospital’s name? (PIN ${answer.pin} is noted.)`);
                }
            } else if (waitingForTown && !answer.town && answer.hospital.split(' ').length <= 3 && placeNeedsTown(draft.hospital!, true)) {
                // We asked which town "Medical College" (or "Jubilee Hospital") is in.
                draft.town = answer.hospital;
                draft.pin = answer.pin ?? draft.pin ?? null;
                draft.place = undefined;
            } else {
                draft.hospital = answer.hospital;
                draft.town = answer.town;
                // A PIN we already have (sent on its own, or in the first message) still applies.
                draft.pin = answer.pin ?? draft.pin ?? null;
                draft.place = undefined;
            }
            break;
        }
        case 'date': {
            const parsed = parseNeededBy(t, today);
            if (!parsed || 'error' in parsed) {
                const why = !parsed || parsed.error === 'invalid'
                    ? 'Please send the date as DD-MM, like 28-10, or tap Today or Tomorrow.'
                    : parsed.error === 'past'
                        ? 'That date has already passed. Choose today or a later date.'
                        : `Requests can be posted up to ${MAX_DAYS_AHEAD} days ahead. Please choose an earlier date.`;
                return ask(from, step, draft, [why]);
            }
            draft.dateNeeded = parsed.date;
            delete draft.pastDate;
            break;
        }
        case 'contact_name': {
            const name = /^(me|myself|same|use (?:my|this) name)$/i.test(t) && draft.profileName ? draft.profileName : parseName(t);
            if (!name) return ask(from, step, draft, ['Please send just the contact person’s name (letters only), like Riya or K. P. Anil.']);
            draft.contactName = name;
            break;
        }
        case 'contact_phone': {
            if (confirmingContact(draft)) {
                // "Contact: Meenu Juseph, +91 70344 52570 [Use this] [Change]": yes, no, or another contact typed.
                if (!answerContact(draft, t)) return ask(from, step, draft, ['Tap “Use this” to keep this contact, or “Change” to give another.']);
                break;
            }
            const mine = /^(this|same|me|mine|my number|this number|use this number|yes)$/i.test(t);
            const phone = mine ? from.slice(2) : parseMobile(t);
            if (!phone) return ask(from, step, draft, ['Please send a 10-digit Indian mobile number, or tap “Use this number”.']);
            draft.contactPhone = phone;
            draft.contactPending = false;
            break;
        }
        case 'confirm':
            // Posting needs the button (or POST typed): a stray message never posts.
            if (/^post(?: request)?$/i.test(t)) return postRequest(from);
            if (/^edit$/i.test(t)) return ask(from, 'edit', draft);
            return ask(from, step, draft, ['Tap “Post request” to publish it, “Edit” to change something, or “Cancel”.']);
        case 'edit': {
            const field = fieldFromText(t);
            if (!field) return ask(from, step, draft, ['Please choose what to change from the list.']);
            return editField(from, draft, field);
        }
    }
    return advance(from, draft);
}

/** A tapped button or list row (payload "rq:..."). */
export async function requestPayload(from: string, parts: string[]) {
    const [action, value] = parts;
    if (action === 'start') return startRequest(from, '');
    if (!requestsEnabled()) return say(from, WEB_FORM_MESSAGE);

    const session = await requestSession(from);
    if (!session || session === 'expired') return say(from, EXPIRED);
    const { step } = session;
    const draft = { ...session.draft };

    switch (action) {
        case 'cancel': return cancelRequest(from);
        case 'post':
            if (step !== 'confirm') return ask(from, step, draft);
            return postRequest(from);
        case 'edit': return ask(from, 'edit', draft);
        case 'field': {
            const field = value as RequestStep;
            if (!FIELD_LABELS[field as keyof typeof FIELD_LABELS]) return ask(from, step, draft);
            return editField(from, draft, field);
        }
    }

    // Answers: only for the question we're on (an old list tapped later is re-asked).
    const expected: Record<string, RequestStep> = {
        bg: 'blood_group', units: 'units', date: 'date', name: 'contact_name', phone: 'contact_phone', contact: 'contact_phone',
    };
    if (expected[action] !== step) return ask(from, step, draft, ['Let’s carry on from here:']);
    switch (action) {
        case 'bg': {
            const group = BLOOD_GROUP_CHOICES.find(g => g === value);
            if (!group) return ask(from, step, draft);
            draft.bloodGroup = group;
            break;
        }
        case 'units': {
            const units = parseUnits(value ?? '', true);
            if (!units) return ask(from, step, draft);
            draft.units = units;
            break;
        }
        case 'date': {
            const today = indiaToday();
            if (value === 'pick') {
                return say(from, `Send the date it’s needed by as DD-MM, for example ${ddmm(addDays(today, 3))}.`);
            }
            draft.dateNeeded = value === 'tomorrow' ? addDays(today, 1) : today;
            delete draft.pastDate;
            break;
        }
        case 'name':
            if (!draft.profileName) return ask(from, step, draft);
            draft.contactName = draft.profileName;
            break;
        case 'phone':
            if (confirmingContact(draft)) return ask(from, step, draft);
            draft.contactPhone = from.slice(2);
            draft.contactPending = false;
            break;
        case 'contact':
            if (!confirmingContact(draft)) return ask(from, step, draft);
            answerContact(draft, value === 'use' ? 'use' : 'change');
            break;
    }
    return advance(from, draft);
}

// ---------------------------------------------------------------------------
// Moving through the questions
// ---------------------------------------------------------------------------

const FIELD_LABELS = {
    blood_group: 'Blood group',
    units: 'Units',
    hospital: 'Hospital',
    date: 'Needed by',
    contact_name: 'Contact name',
    contact_phone: 'Contact number',
} as const;

function fieldFromText(t: string): RequestStep | null {
    const s = t.toLowerCase();
    if (/group|blood/.test(s)) return 'blood_group';
    if (/unit|bottle/.test(s)) return 'units';
    if (/hospital|place|town|pin|location/.test(s)) return 'hospital';
    if (/date|day|needed|when/.test(s)) return 'date';
    if (/name/.test(s)) return 'contact_name';
    if (/number|phone|mobile|contact/.test(s)) return 'contact_phone';
    return null;
}

function editField(from: string, draft: RequestDraft, field: RequestStep) {
    const d: RequestDraft = { ...draft, editing: true };
    switch (field) {
        case 'blood_group': delete d.bloodGroup; break;
        case 'units': delete d.units; break;
        case 'hospital': delete d.hospital; delete d.town; delete d.pin; delete d.place; break;
        case 'date': delete d.dateNeeded; delete d.pastDate; break;
        case 'contact_name': delete d.contactName; d.contactPending = false; break;
        case 'contact_phone': delete d.contactPhone; d.contactPending = false; break;
        default: return ask(from, 'edit', draft);
    }
    return advance(from, d);
}

/** Resolves the place if needed, saves the draft and asks the next question (or shows the summary). */
async function advance(from: string, draft: RequestDraft, prefix: string[] = []) {
    // Why the hospital still needs a town: said when that question comes (the units may be asked first).
    let placeMessage: string | null = null;
    if (draft.hospital && !draft.place) {
        const found = await resolvePlace(from, draft);
        if ('place' in found) {
            draft.place = found.place;
        } else if (!found.keepName) {
            delete draft.hospital; delete draft.town; delete draft.pin;
            prefix.push(found.message);
        } else placeMessage = found.message;
    }
    const step = nextStep(draft);
    if (placeMessage && step === 'hospital') prefix.push(placeMessage);
    if (step === 'confirm') draft.editing = false;
    await save(from, step, draft);
    return ask(from, step, draft, prefix);
}

const ddmm = (iso: string) => `${iso.slice(8, 10)}-${iso.slice(5, 7)}`;
const firstName = (full?: string | null) => (full || '').trim().split(/\s+/)[0] || '';

/** "O+ · 2 units · Govt Medical College, Kozhikode" from what's filled in. */
function describe(d: RequestDraft): string {
    const today = indiaToday();
    return [
        d.bloodGroup && formatBloodGroup(d.bloodGroup),
        d.units && `${d.units} unit${d.units === 1 ? '' : 's'}`,
        d.hospital && [d.hospital, d.town, d.pin].filter(Boolean).join(', '),
        d.dateNeeded && `needed ${d.dateNeeded === today || d.dateNeeded === addDays(today, 1) ? '' : 'by '}${neededByLabel(d.dateNeeded, today)}`,
        d.contactName && `contact ${d.contactName}${d.contactPhone ? `, ${formatWaNumber(`91${d.contactPhone}`)}` : ''}`,
    ].filter(Boolean).join(' · ');
}

function placeNote(p: PlaceMatch, pin?: string | null): string {
    if (p.precision === 'hospital') return `Map: “${p.label}”. Please check this is the right place; donors within ${MATCH_RADIUS_KM} km of it are alerted.`;
    const where = p.precision === 'pin' && pin
        ? `PIN ${pin}${p.district ? ` (${p.district})` : ''}`
        : p.precision === 'district' ? `${p.district ?? p.label} district` : (p.city ?? p.label);
    return `We couldn’t find the hospital itself on the map, so donors are matched from the centre of ${where}.`;
}

/** Sends the question for `step` (with any lines before it). */
async function ask(from: string, step: RequestStep, draft: RequestDraft, prefix: string[] = []) {
    const body = (q: string) => [...prefix, q].join('\n\n');
    const ctx = { kind: 'request_flow' as const };
    switch (step) {
        case 'blood_group':
            return sendList(from, body('Which blood group does the patient need?'), 'Choose blood group',
                BLOOD_GROUP_CHOICES.map(g => ({ id: `rq:bg:${g}`, title: formatBloodGroup(g) })), ctx);
        case 'units':
            return sendList(from, body(`How many units are needed? Choose below, or type a number up to ${MAX_UNITS}.`), 'Choose units',
                [1, 2, 3, 4, 5].map(n => ({ id: `rq:units:${n}`, title: n === 1 ? '1 unit' : `${n} units` })), ctx);
        case 'hospital':
            if (draft.hospital && !draft.place) {
                // We have a name but couldn't place it yet (the reason is in the prefix).
                return say(from, body(`Which town or PIN code is ${draft.hospital} in?`));
            }
            if (draft.pin) return say(from, body(`Which hospital is the patient in? Send its name (PIN ${draft.pin} is noted).`));
            return say(from, body('Which hospital is the patient in? Send its name and town, or its 6-digit PIN code.\n\nFor example: Govt Medical College, Kozhikode 673008'));
        case 'date':
            return sendButtons(from, body(dateQuestion(draft, indiaToday())), [
                { id: 'rq:date:today', title: 'Today' },
                { id: 'rq:date:tomorrow', title: 'Tomorrow' },
                { id: 'rq:date:pick', title: 'Another date' },
            ], ctx);
        case 'contact_name':
            if (draft.profileName) {
                return sendButtons(from, body(`Who should donors call? Tap to use ${draft.profileName}, or type another name.`),
                    [{ id: 'rq:name:me', title: `Use ${firstName(draft.profileName)}`.slice(0, 20) }], ctx);
            }
            return say(from, body('Who should donors call? Send the contact person’s name.'));
        case 'contact_phone':
            if (confirmingContact(draft)) {
                return sendButtons(from, body(`Who should donors call? From your message:\n${contactLine(draft)}`), [
                    { id: 'rq:contact:use', title: 'Use this' },
                    { id: 'rq:contact:change', title: 'Change' },
                ], ctx);
            }
            return sendButtons(from, body(`And the contact number? Tap “Use this number” for ${formatWaNumber(from)}, or type another 10-digit mobile number.`),
                [{ id: 'rq:phone:me', title: 'Use this number' }], ctx);
        case 'edit':
            await save(from, 'edit', draft);
            return sendList(from, body('What would you like to change?'), 'Choose what to change',
                (Object.keys(FIELD_LABELS) as Array<keyof typeof FIELD_LABELS>).map(f => ({ id: `rq:field:${f}`, title: FIELD_LABELS[f] })), ctx);
        case 'confirm':
            return sendButtons(from, body(summary(from, draft)), [
                { id: 'rq:post', title: 'Post request' },
                { id: 'rq:edit', title: 'Edit' },
                { id: 'rq:cancel', title: 'Cancel' },
            ], ctx);
    }
}

function summary(from: string, d: RequestDraft): string {
    const updates = waNumber(d.contactPhone) === from
        ? 'When a donor offers, we’ll message you here.'
        : 'Offers will show in My requests on Vital (WhatsApp updates only go to the number you’re messaging from).';
    const urgency = d.urgent && d.dateNeeded ? urgencyFor(d.dateNeeded, indiaToday()) : null;
    return [
        'Please check your request:',
        describe(d),
        [d.patientName && `Patient: ${d.patientName}`, d.notes && `Notes: ${d.notes}`].filter(Boolean).join('\n'),
        urgency === 'High'
            ? 'Urgency: High (needed today or tomorrow).'
            : urgency
                ? `Your message says urgent; urgency is set from the date: ${urgency}. If it’s needed sooner, tap Edit and change the date.`
                : '',
        d.place ? placeNote(d.place, d.pin) : '',
        updates,
        `By posting you agree to Vital’s Terms and Privacy notice: ${SITE}/terms`,
        PLATFORM_DISCLAIMER,
    ].filter(Boolean).join('\n\n');
}

// ---------------------------------------------------------------------------
// Where the hospital is
// ---------------------------------------------------------------------------

type Resolved = { place: PlaceMatch } | { message: string; keepName: boolean };

const fromArea = (a: Area, label: string, zipcode: string | null): PlaceMatch => ({
    latitude: a.latitude, longitude: a.longitude,
    precision: a.precision === 'pin' ? 'pin' : a.precision === 'district' ? 'district' : 'city',
    label, city: a.city, district: a.district, state: a.state, zipcode,
});

/**
 * The hospital on the map (Nominatim search for its name and town), checked
 * against its PIN area when there is one; else the PIN area's (or district's)
 * centre; else the town's centre. Always inside India.
 */
async function resolvePlace(from: string, d: RequestDraft): Promise<Resolved> {
    const hospital = d.hospital!;
    if (!d.pin && !d.town && placeNeedsTown(hospital, true)) {
        return { message: `Many hospitals are called “${hospital}”.`, keepName: true };
    }
    if (!(await rateLimit(`wa-geocode:${from}`, 60 * 60, 12))) {
        return { message: `We’ve looked up a lot of places for this number in the last hour. Please try again later, or post on ${SITE_URL}/requests/new.`, keepName: false };
    }

    let area: Area | null = null;
    let lookupDown = false;
    if (d.pin) {
        const r = await locatePin(d.pin);
        if (r.status === 'not_found') {
            return { message: `We couldn’t find PIN code ${d.pin}. Please check it and send the hospital’s name with its town or PIN again.`, keepName: false };
        }
        if (r.status === 'found') area = r.area;
        else lookupDown = true;
    }

    const query = [hospital, d.town, area?.district, area?.state].filter(Boolean).join(', ');
    let match: Place | null = null;
    try {
        match = (await searchPlaces(`q=${encodeURIComponent(query)}`, 1, { timeoutMs: 6000, slotAttempts: 3 }))[0] ?? null;
    } catch {
        lookupDown = true;
    }
    if (match && area && distanceKm(match.latitude, match.longitude, area.latitude, area.longitude) > MAX_MATCH_FROM_PIN_KM) match = null;
    if (match && insideIndia(match.latitude, match.longitude)) {
        return { place: {
            latitude: match.latitude, longitude: match.longitude, precision: 'hospital',
            label: (match.displayName.split(',').slice(0, 3).join(',').trim() || match.label).slice(0, 120),
            city: match.city ?? area?.city ?? null, district: match.district ?? area?.district ?? null,
            state: match.state ?? area?.state ?? null, zipcode: d.pin ?? match.zipcode,
        } };
    }
    if (area) return { place: fromArea(area, `PIN ${d.pin}`, d.pin ?? null) };

    // The town, as typed after a comma (or the last word of the name: "KIMS Trivandrum").
    const town = d.town ?? (hospital.includes(' ') ? hospital.split(' ').pop()! : null);
    if (town && town.length >= 3) {
        const r = await locateCity(town);
        if (r.status === 'found') return { place: fromArea(r.area, r.area.city ?? town, null) };
        if (r.status === 'unavailable') lookupDown = true;
    }
    if (lookupDown) {
        return { message: 'Our map lookup isn’t responding right now, so we couldn’t place the hospital. A 6-digit PIN code works best; or try again in a minute.', keepName: true };
    }
    return { message: `We couldn’t find “${[hospital, d.town].filter(Boolean).join(', ')}” on the map in India. Please send the hospital’s name with its town, or its 6-digit PIN code.`, keepName: false };
}

// ---------------------------------------------------------------------------
// Posting
// ---------------------------------------------------------------------------

/**
 * The account to post on: the one that has proven this number, else a new
 * phone-only account with the number confirmed (WhatsApp proves it) and the
 * consent given on WhatsApp. The database's phone triggers (20261022000100)
 * then verify the number on the new profile and release it from accounts that
 * only typed it. Never a donor.
 */
async function accountFor(from: string, name: string): Promise<string> {
    const existing = await provenAccount(from);
    if (existing) return existing;
    const admin = serviceClient();
    const create = () => admin.auth.admin.createUser({
        phone: from,
        phone_confirm: true,
        user_metadata: { full_name: name, ...consentStamp(), signup_source: 'whatsapp_request' },
    });
    let { data, error } = await create();
    if (error) {
        // Lost a race with another message, or an unfinished phone sign-in
        // holds the number without having proven it.
        const again = await provenAccount(from);
        if (again) return again;
        await admin.rpc('wa_release_unconfirmed_phone', { p_wa: from });
        ({ data, error } = await create());
    }
    if (error || !data.user) throw new Error(`whatsapp request: could not create the account (${error?.message ?? 'no user'})`);
    return data.user.id;
}

/** Consent (as on the web form: the earliest for the current version) and a name, never is_donor. */
async function stampRequester(userId: string, name: string) {
    const admin = serviceClient();
    const { data: existing } = await admin.from('profiles')
        .select('full_name, consent_agreed, consent_at, consent_version').eq('id', userId).maybeSingle();
    const patch: Record<string, unknown> = {};
    if (!hasRecordedConsent(existing)) {
        const consent = consentStamp();
        Object.assign(patch, consent, { consent_at: earliestConsentAt(existing, consent) ?? consent.consent_at });
    }
    if (!existing?.full_name?.trim()) patch.full_name = name;
    if (!Object.keys(patch).length) return;
    const { error } = existing
        ? await admin.from('profiles').update(patch).eq('id', userId)
        : await admin.from('profiles').upsert({ id: userId, ...patch }, { onConflict: 'id' });
    if (error) throw new Error(`whatsapp request: profile update failed (${error.message})`);
}

const round5 = (n: number) => Math.round(n * 1e5) / 1e5;

async function postRequest(from: string) {
    const admin = serviceClient();
    // Claim the draft: of two quick taps on "Post request" only one gets it.
    const { data: claimed } = await admin.from('whatsapp_sessions').delete()
        .eq('wa_number', from).eq('awaiting', 'request').eq('step', 'confirm')
        .gt('expires_at', new Date().toISOString())
        .select('draft').maybeSingle();
    if (!claimed) {
        const session = await requestSession(from);
        if (session && session !== 'expired') return ask(from, session.step, session.draft);
        return say(from, EXPIRED);
    }

    const draft = claimed.draft as RequestDraft;
    const today = indiaToday();
    if (nextStep(draft) !== 'confirm') return advance(from, draft);
    if (draft.dateNeeded! < today) {
        delete draft.dateNeeded;
        return advance(from, { ...draft, editing: true }, ['The date you chose has passed.']);
    }
    if (await postedToday(from) >= MAX_REQUESTS_PER_DAY) {
        return say(from, `You’ve posted ${MAX_REQUESTS_PER_DAY} requests from this number in the last 24 hours, which is the limit on WhatsApp. To post another, use ${SITE_URL}/requests/new.`);
    }

    const place = draft.place!;
    const contactWa = waNumber(draft.contactPhone)!;
    let request: AlertableRequest;
    let userId: string;
    try {
        userId = await accountFor(from, draft.contactName!);
        await stampRequester(userId, draft.contactName!);

        const address = [draft.hospital, draft.town, draft.pin].filter(Boolean).join(', ');
        const { data, error } = await admin.from('blood_requests').insert({
            user_id: userId,
            blood_group: draft.bloodGroup,
            units_needed: draft.units,
            date_needed: draft.dateNeeded,
            hospital_name: draft.hospital,
            hospital_address: address,
            urgency_level: urgencyFor(draft.dateNeeded!, today),
            notes: draft.notes ?? '',
            contact_name: draft.contactName,
            location: {
                latitude: round5(place.latitude),
                longitude: round5(place.longitude),
                address,
                source: place.precision === 'hospital' ? 'search' : place.precision,
                label: place.label,
            },
            city: (draft.town || place.city || place.district || '').slice(0, 80),
            zipcode: draft.pin || place.zipcode || '',
            status: 'active',
        }).select(ALERT_REQUEST_COLUMNS).single<AlertableRequest>();
        if (error || !data) throw new Error(`whatsapp request: insert failed (${error?.message ?? 'no row'})`);
        request = data;

        // The phone lives in request_contacts (only the requester and donors who offer can read it).
        const { error: contactError } = await admin.from('request_contacts').insert({
            request_id: request.id,
            contact_phone: draft.contactPhone,
            whatsapp_updates: contactWa === from,
        });
        if (contactError) {
            await admin.from('blood_requests').delete().eq('id', request.id);
            throw new Error(`whatsapp request: contact insert failed (${contactError.message})`);
        }
    } catch (error) {
        console.error(error instanceof Error ? error.message : error);
        await save(from, 'confirm', draft).catch(() => {});
        return say(from, SORRY);
    }

    let reached: number | null = null;
    try {
        const counts = await alertDonors(request);
        reached = (counts.whatsappSent + counts.emailsSent) || counts.notificationsSent;
    } catch (error) {
        console.error('whatsapp request: alerting donors failed', error);
    }

    const link = `${SITE_URL}/requests/${request.id}`;
    return sendText(from, [
        `Your request is live: ${link}`,
        'Share this link with family, friends and groups to reach more people.',
        reached === null
            ? 'We’re alerting donors nearby.'
            : reached > 0
                ? `We alerted ${reached} donor${reached === 1 ? '' : 's'} nearby.`
                : 'We couldn’t find registered donors nearby yet, so sharing the link matters most.',
        contactWa === from ? 'When a donor offers, we’ll message you here.' : '',
        `To edit or close it, or to confirm a donation, sign in on ${SITE} with “Continue with WhatsApp” using this number, then open My requests.`,
        PLATFORM_DISCLAIMER,
    ].filter(Boolean).join('\n\n'), { kind: 'request_posted', userId, requestId: request.id });
}
