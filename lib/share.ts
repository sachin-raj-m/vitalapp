// Share text for blood requests and donor cards. Safe on the server, the client and the edge.
// Never add a phone number here: request contacts are private by design.

import { format, parseISO, isValid } from 'date-fns';
import { formatBloodGroup, getCompatibleDonors } from '@/lib/blood-compatibility';
import type { BloodRequest } from '@/types';

/** The request fields a share needs. Everything except id and blood_group is optional. */
export type ShareableRequest = Pick<BloodRequest, 'id' | 'blood_group'> &
    Partial<Pick<BloodRequest, 'units_needed' | 'hospital_name' | 'city' | 'date_needed' | 'urgency_level' | 'status'>>;

export const URGENCY_LABEL: Record<string, string> = { High: 'Urgent', Medium: 'Needed soon', Low: 'Planned' };

export const SHARE_DISCLAIMER = 'Vital only connects donors and families. It does not arrange or guarantee donations.';

export const requestPath = (id: string) => `/requests/${id}`;

export const unitsLabel = (n?: number | null) => (n && n > 0 ? `${n} unit${n === 1 ? '' : 's'}` : '');

/** "Thu, 14 Nov" (adds the year when it is not this year). Accepts a date or timestamp string. */
export function formatNeededBy(date?: string | null): string {
    if (!date) return '';
    // Use the calendar date only, so time zones never shift the day.
    const d = parseISO(/^\d{4}-\d{2}-\d{2}/.test(date) ? date.slice(0, 10) : date);
    if (!isValid(d)) return '';
    return format(d, d.getFullYear() === new Date().getFullYear() ? 'EEE, d MMM' : 'EEE, d MMM yyyy');
}

/** "General Hospital, Kochi", without repeating the city when the hospital name already has it. */
export function placeLabel(hospital?: string | null, city?: string | null): string {
    const h = hospital?.trim() || '';
    const c = city?.trim() || '';
    if (!c) return h;
    if (!h) return c;
    return h.toLowerCase().includes(c.toLowerCase()) ? h : `${h}, ${c}`;
}

export const compatibleDonorGroups = (group: string) =>
    getCompatibleDonors(group as BloodRequest['blood_group']).map(formatBloodGroup);

/** "B+ blood needed - Urgent", or a closed-state headline. */
export function requestHeadline(r: ShareableRequest): string {
    const group = formatBloodGroup(r.blood_group);
    if (r.status === 'fulfilled') return `${group} blood request fulfilled`;
    if (r.status === 'cancelled') return `${group} blood request closed`;
    const urgency = r.urgency_level ? URGENCY_LABEL[r.urgency_level] : '';
    return urgency ? `${group} blood needed - ${urgency}` : `${group} blood needed`;
}

/** The body lines of a share, without the headline and URL. Lines with missing data are left out. */
function requestDetailLines(r: ShareableRequest): string[] {
    const units = unitsLabel(r.units_needed);
    const place = placeLabel(r.hospital_name, r.city);
    const neededBy = formatNeededBy(r.date_needed);
    const donors = compatibleDonorGroups(r.blood_group);

    const lines: string[] = [];
    if (units && place) lines.push(`${units} at ${place}`);
    else if (units || place) lines.push(units ? `${units} needed` : `At ${place}`);
    if (neededBy && (!r.status || r.status === 'active')) lines.push(`Needed by ${neededBy}`);
    if (donors.length) lines.push(`Compatible donors: ${donors.join(', ')}`);
    return lines;
}

export interface RequestShare {
    url: string;
    /** Plain headline, for navigator.share's title and page titles. */
    title: string;
    /** Text for navigator.share. Has no URL: share targets append `url` themselves. */
    text: string;
    /** The full message with the URL once, for the clipboard and WhatsApp links. */
    message: string;
}

/**
 * Builds the share for a request. WhatsApp renders *text* as bold.
 *
 *   *B+ blood needed - Urgent*
 *   2 units at General Hospital, Kochi
 *   Needed by Thu, 14 Nov
 *   Compatible donors: O−, O+, B−, B+
 *
 *   Can you help or forward this? https://vitalapp.in/requests/<id>
 *
 *   Vital only connects donors and families. It does not arrange or guarantee donations.
 */
export function buildRequestShare(r: ShareableRequest, origin: string): RequestShare {
    const url = `${origin.replace(/\/$/, '')}${requestPath(r.id)}`;
    const title = requestHeadline(r);
    const body = [`*${title}*`, ...requestDetailLines(r)].join('\n');
    const open = !r.status || r.status === 'active';
    const ask = open ? 'Can you help or forward this?' : 'See open requests on Vital.';

    return {
        url,
        title,
        // Ask last, so the URL the share target appends follows it.
        text: `${body}\n\n${SHARE_DISCLAIMER}\n\n${ask}`,
        message: `${body}\n\n${ask} ${url}\n\n${SHARE_DISCLAIMER}`,
    };
}

/** One-line summary for meta descriptions. */
export function requestDescription(r: ShareableRequest): string {
    const group = formatBloodGroup(r.blood_group);
    const units = unitsLabel(r.units_needed);
    const place = placeLabel(r.hospital_name, r.city);
    const neededBy = formatNeededBy(r.date_needed);
    const urgency = r.urgency_level ? URGENCY_LABEL[r.urgency_level] : '';
    const donors = compatibleDonorGroups(r.blood_group);

    const first = [urgency ? `${urgency}:` : '', units ? `${units} of ${group} blood needed` : `${group} blood needed`, place ? `at ${place}` : '', neededBy ? `by ${neededBy}` : '']
        .filter(Boolean)
        .join(' ');
    const second = donors.length ? ` Donors with ${donors.join(', ')} can help.` : '';
    return `${first}.${second} Can you donate or forward this?`;
}

export const whatsappShareUrl = (message: string) => `https://wa.me/?text=${encodeURIComponent(message)}`;

/** Share message for a donor's public card (or an invite when the card is private). */
export function buildDonorShareMessage(opts: { origin: string; path: string; isPublic: boolean; bloodGroup?: string | null }): string {
    const origin = opts.origin.replace(/\/$/, '');
    const group = opts.bloodGroup ? formatBloodGroup(opts.bloodGroup) : '';
    const intro = group ? `I'm a registered ${group} blood donor on Vital.` : `I'm a registered blood donor on Vital.`;
    const lines = [
        `*${intro}*`,
        'Vital is a free, voluntary network that alerts nearby donors when someone needs blood.',
        `Signing up takes two minutes: ${origin}/register`,
    ];
    if (opts.isPublic) lines.push('', `My donor card: ${origin}${opts.path}`);
    return lines.join('\n');
}
