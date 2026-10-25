import type { BloodGroup } from '@/types';

/**
 * Reading a blood request out of WhatsApp messages. Pure functions, no I/O:
 * safe anywhere, and checked by scripts/check-whatsapp-request-parse.ts.
 *
 * People write things like
 *   "need O+ blood"            "Urgent B negative 2 units at Medical College Kozhikode"
 *   "AB+ve 3 bottles KIMS Trivandrum tomorrow"   "blood required o positive"
 *   "ഒ പോസിറ്റീവ് രക്തം ആവശ്യമുണ്ട്"   "B+ खून चाहिए"
 * The bot takes what it can from the first message and asks for the rest
 * (lib/whatsapp-request.ts). Anything doubtful is left out rather than guessed:
 * every value is shown back in the summary before anything is posted.
 */

export const MAX_UNITS = 20;
/** How far ahead "needed by" may be. */
export const MAX_DAYS_AHEAD = 90;

const GROUPS: BloodGroup[] = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
export const BLOOD_GROUP_CHOICES = GROUPS;

// Letters (Latin, Devanagari, Malayalam) used for the "is this a word?" checks.
const LETTER = 'a-z\\u0900-\\u097f\\u0d00-\\u0d7f';

// Group letters: AB, A, B, O (and the digit 0 people type for O); A1/A2
// subgroups count as A, A1B/A2B as AB. Malayalam / Devanagari spellings too.
const GROUP_PART = '(a\\s*[12]?\\s*b|ab|a\\s*[12]|a|b|o|0|എബി|എ|ബി|ഒ|ഓ|एबी|ए|बी|ओ)';
// Optional "Rh" between group and sign: "O Rh+", "B (Rh) negative".
const RH_PART = '(?:\\s*\\(?\\s*rh\\s*\\)?)?';
const POSITIVE = '\\+\\s*(?:ve|ive)?|positive|pos\\b|\\(\\s*\\+\\s*\\)|\\+|പോസിറ്റീവ്|पॉजिटिव|पोजिटिव|पॉज़िटिव';
// A hyphen right after the group is "negative" ("AB- 2 units"); a spaced one
// only when no number follows ("B - 2 units" is not B-).
const NEGATIVE = '(?:-|−|–)\\s*(?:ve|ive)\\b|negative|neg\\b|\\(\\s*-\\s*\\)|നെഗറ്റീവ്|नेगेटिव|नेगटिव|(?:-|−|–)(?!\\s*\\d)';
const GROUP_RE = new RegExp(
    `(?<![${LETTER}0-9])${GROUP_PART}(?:${RH_PART}\\s*\\(?\\s*(?:(${POSITIVE})|(?:${NEGATIVE}))\\s*\\)?|(?:-|−|–))(?![${LETTER}])`,
    'iu',
);

const GROUP_LETTERS: Record<string, string> = {
    'എബി': 'AB', 'എ': 'A', 'ബി': 'B', 'ഒ': 'O', 'ഓ': 'O',
    'एबी': 'AB', 'ए': 'A', 'बी': 'B', 'ओ': 'O',
};

/** "O positive", "o+ve", "AB -", "B(Rh) neg", "0+" -> 'O+' etc.; null if none. */
export function parseBloodGroup(text: string): BloodGroup | null {
    const m = GROUP_RE.exec(text);
    if (!m) return null;
    const raw = m[1].replace(/\s+/g, '').toLowerCase();
    let letters = GROUP_LETTERS[raw] ?? raw.toUpperCase().replace(/[12]/g, '');
    if (letters === '0') letters = 'O';
    const group = `${letters}${m[2] ? '+' : '-'}` as BloodGroup;
    return GROUPS.includes(group) ? group : null;
}

const NUMBER_WORDS: Record<string, number> = {
    one: 1, a: 1, an: 1, single: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};
const UNIT_WORD = '(?:units?|unit\\(s\\)|bottles?|bags?|pints?|packets?|packs?|യൂണിറ്റ്|യൂണിറ്റുകൾ|കുപ്പി|यूनिट|बोतल)';

/**
 * "2 units", "3 bottles", "two units", "units: 2", "2u". With `bare`, a message
 * that is only a number ("2") counts too (used when we asked for units).
 * null when there is no count, or it isn't 1..MAX_UNITS.
 */
export function parseUnits(text: string, bare = false): number | null {
    const t = text.toLowerCase();
    let n: number | null = null;
    const digits = new RegExp(`(?<![\\d.\\-/])(\\d{1,3})\\s*(?:${UNIT_WORD}|u\\b)`, 'u').exec(t)
        ?? new RegExp(`${UNIT_WORD}\\s*[:=\\-]?\\s*(\\d{1,3})(?![\\d.\\-/])`, 'u').exec(t);
    if (digits) n = Number(digits[1]);
    else {
        const word = new RegExp(`\\b(${Object.keys(NUMBER_WORDS).join('|')})\\s+${UNIT_WORD}`, 'u').exec(t);
        if (word) n = NUMBER_WORDS[word[1]];
        else if (bare) {
            const only = /^\s*(\d{1,3})\s*$/.exec(t) ?? new RegExp(`^\\s*(${Object.keys(NUMBER_WORDS).join('|')})\\s*$`).exec(t);
            if (only) n = /^\d/.test(only[1]) ? Number(only[1]) : NUMBER_WORDS[only[1]];
        }
    }
    return n !== null && Number.isInteger(n) && n >= 1 && n <= MAX_UNITS ? n : null;
}

/** A 6-digit Indian PIN code in the text (not part of a longer number). */
export function parsePin(text: string): string | null {
    const m = /(?<![\d])([1-9]\d{2})\s?(\d{3})(?![\d])/.exec(text);
    if (!m) return null;
    // "98765 43210" is a phone number split in two, not a PIN.
    if (/(?<!\d)[6-9]\d{4}[\s-]?\d{5}(?!\d)/.test(text.slice(Math.max(0, m.index - 6), m.index + m[0].length + 6)) && m[0].includes(' ')) return null;
    return m[1] + m[2];
}

const MOBILE_RE = /(?<![\d])(?:\+?\s*91[\s-]*|0)?([6-9]\d{4})[\s-]?(\d{5})(?![\d])/;

/** The first Indian mobile number in the text, as 10 digits; null if none. */
export function parseMobile(text: string): string | null {
    const m = MOBILE_RE.exec(text);
    return m ? m[1] + m[2] : null;
}

// ---------------------------------------------------------------------------
// Dates. `today` is the date in India, 'YYYY-MM-DD' (indiaToday()).
// ---------------------------------------------------------------------------

/** Today's date in India as 'YYYY-MM-DD'. */
export const indiaToday = (now = Date.now()) => new Date(now + 5.5 * 3600_000).toISOString().slice(0, 10);

export function addDays(day: string, n: number): string {
    const d = new Date(`${day}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
}

const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400_000);

const MONTHS: Record<string, number> = {
    jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
    jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};
const MONTH_NAMES = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');

export type DateParse = { date: string } | { error: 'past' | 'far' | 'invalid' };

// "Urgent" alone is not a date: it is often followed by one ("urgent, needed by Friday").
const TODAY_WORDS = /(?<![a-z])(today|tonight|now|right now|asap|immediately|this (?:morning|evening|afternoon)|aaj|innu|ഇന്ന്|ഇപ്പോൾ|आज|अभी|तुरंत)(?![a-z])/iu;
const DAY_AFTER_WORDS = /(?<![a-z])(day after tomorrow|day after tmrw|parso|marenaal|മറ്റന്നാൾ|परसों)(?![a-z])/iu;
const TOMORROW_WORDS = /(?<![a-z])(tomorrow|tommorow|tomorow|tmrw|tmr|tomo|nale|naale|നാളെ)(?![a-z])/iu;

function checkDate(y: number, m: number, d: number, today: string, yearGiven: boolean): DateParse {
    if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31)) return { error: 'invalid' };
    const iso = (yy: number) => `${yy}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    let date = iso(y);
    // Reject 31-02 and the like (Date rolls them over).
    if (new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) return { error: 'invalid' };
    if (date < today) {
        // "02-01" typed on 30 December means next January.
        if (!yearGiven && daysBetween(date, today) > 180) {
            date = iso(y + 1);
            if (new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) return { error: 'invalid' };
        } else return { error: 'past' };
    }
    if (daysBetween(today, date) > MAX_DAYS_AHEAD) return { error: 'far' };
    return { date };
}

/**
 * "today", "tomorrow", "day after tomorrow", "28-10", "28/10/2026", "28.10",
 * "28 Oct", "Oct 28", "28th October". A d-m pattern followed by "units" is
 * not a date ("1-2 units").
 */
export function parseNeededBy(text: string, today: string): DateParse | null {
    const t = text.toLowerCase();
    if (DAY_AFTER_WORDS.test(t)) return { date: addDays(today, 2) };
    if (TOMORROW_WORDS.test(t)) return { date: addDays(today, 1) };
    if (TODAY_WORDS.test(t)) return { date: today };

    const [ty] = today.split('-').map(Number);
    const numeric = /(?<![\d.\-/])(\d{1,2})\s*[/\-.]\s*(\d{1,2})(?:\s*[/\-.]\s*(\d{4}|\d{2}))?(?![\d])(?!\s*(?:units?|bottles?|bags?|pints?))/.exec(t);
    if (numeric) {
        const [, d, m, y] = numeric;
        const year = y ? (y.length === 2 ? 2000 + Number(y) : Number(y)) : ty;
        return checkDate(year, Number(m), Number(d), today, !!y);
    }
    const dayMonth = new RegExp(`(?<!\\d)(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:of\\s+)?(${MONTH_NAMES})\\b\\.?(?:\\s*,?\\s*(\\d{4}))?`).exec(t);
    if (dayMonth) {
        const [, d, mon, y] = dayMonth;
        return checkDate(y ? Number(y) : ty, MONTHS[mon], Number(d), today, !!y);
    }
    const monthDay = new RegExp(`\\b(${MONTH_NAMES})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?!\\d)(?:\\s*,?\\s*(\\d{4}))?`).exec(t);
    if (monthDay) {
        const [, mon, d, y] = monthDay;
        return checkDate(y ? Number(y) : ty, MONTHS[mon], Number(d), today, !!y);
    }
    return null;
}

// ---------------------------------------------------------------------------
// Is this message asking for blood?
// ---------------------------------------------------------------------------

const NEED_WORDS = /(?<![a-z])(need(?:s|ed)?|require[ds]?|required|requirement|req|urgent(?:ly)?|emergency|wanted|want|looking for|searching for|help|sos|chahiye|chaiye|jarurat|zaroorat|venam|venum|aavashyam|aavasyam|ആവശ്യ\w*|വേണം|അത്യാവശ്യ\w*|ചാഹിയേ|चाहिए|ज़रूरत|जरूरत|आवश्यकता|आवश्यक)(?![a-z])/iu;
const BLOOD_WORDS = /(?<![a-z])(blood|donors?|units?|bottles?|plasma|platelets?|sdp|prbc|rakt|khoon|khun|raktham|രക്ത\w*|ബ്ലഡ്|रक्त|खून|ब्लड)(?![a-z])/iu;
const DONOR_INTENT = /(?<![a-z])((?:i|we)\s*(?:am|'m|can|could|will|would|wish|want|like)?\s*(?:like\s+)?(?:to\s+)?(?:willing\s+to\s+)?donate|ready to donate|willing to donate|can donate|i'?m a donor|register as (?:a )?donor|become a donor)(?![a-z])/i;
const HOSPITAL_WORDS = /(?<![a-z])(hospital|hosp|medical college|mch|medical cent(?:re|er)|clinic|blood bank|nursing home|institute|aiims|jipmer|icu|ward)(?![a-z])/i;

/** REQUEST, "request blood", "new request", "post a request". */
export function isRequestCommand(text: string): boolean {
    return /^\s*(?:new\s+|post\s+(?:a\s+)?)?request(?:\s+(?:blood|for blood))?\s*[.!]*\s*$/i.test(text)
        || /^\s*(?:i\s+)?need\s+blood\s*[.!]*\s*$/i.test(text);
}

/**
 * True for a message that asks for blood: a need word with a blood word or a
 * blood group ("need O+", "blood required", "urgent AB- 2 units"), or a blood
 * group with units or a hospital ("O+ 2 units KIMS"). Donors saying they can
 * give ("I can donate O+") are not a request.
 */
export function looksLikeBloodNeed(text: string): boolean {
    const t = text.trim();
    if (t.length < 4 || t.length > 1000) return false;
    if (DONOR_INTENT.test(t)) return false;
    const group = parseBloodGroup(t) !== null;
    const blood = BLOOD_WORDS.test(t);
    if (NEED_WORDS.test(t) && (group || blood)) return true;
    if (group && (parseUnits(t) !== null || HOSPITAL_WORDS.test(t))) return true;
    return false;
}

// ---------------------------------------------------------------------------
// Hospital and place
// ---------------------------------------------------------------------------

// Words that are about the request, not the place.
const FILLER = new RegExp(
    `(?<![${LETTER}])(?:hi|hello|hai|dear|sir|madam|please|pls|plz|kindly|very|urgent(?:ly)?|emergency|immediately|asap|need(?:s|ed)?|require[ds]?|required|requirement|req|wanted|want|looking for|searching for|help|sos|blood|donors?|donation|of|for|the patient|patient|is|are|admitted|group|type|units?|bottles?|bags?|pints?|today|tonight|tomorrow|tmrw|now|contact|call|whatsapp|chahiye|venam|rakt|khoon|raktham|രക്ത\\w*|ആവശ്യ\\w*|വേണം|ബ്ലഡ്|रक्त|खून|चाहिए|ज़रूरत|जरूरत)(?![${LETTER}])`,
    'giu',
);

const clean = (s: string) => s.replace(/\s+/g, ' ').replace(/^[\s,.:;\-–—|]+|[\s,.:;\-–—|!?]+$/g, '').trim();

/** Strips what the other parsers understood, leaving the place words. */
function withoutKnownParts(text: string): string {
    return text
        .replace(new RegExp(GROUP_RE.source, 'giu'), ' | ')
        .replace(new RegExp(MOBILE_RE.source, 'g'), ' | ')
        .replace(/(?<!\d)[1-9]\d{2}\s?\d{3}(?!\d)/g, ' | ')
        .replace(new RegExp(`(?<![\\d.\\-/])\\d{1,3}\\s*(?:${UNIT_WORD}|u\\b)`, 'giu'), ' | ')
        .replace(new RegExp(`\\b(?:${Object.keys(NUMBER_WORDS).join('|')})\\s+${UNIT_WORD}`, 'giu'), ' | ')
        .replace(/(?<![\d])\d{1,2}\s*[/\-.]\s*\d{1,2}(?:\s*[/\-.]\s*\d{2,4})?(?!\d)/g, ' | ')
        .replace(new RegExp(`(?<!\\d)\\d{1,2}(?:st|nd|rd|th)?\\s*(?:of\\s+)?(?:${MONTH_NAMES})\\b\\.?`, 'gi'), ' | ')
        .replace(DAY_AFTER_WORDS, ' | ')
        .replace(new RegExp(TODAY_WORDS.source, 'giu'), ' | ')
        .replace(new RegExp(TOMORROW_WORDS.source, 'giu'), ' | ');
}

/**
 * The hospital (and town, if given separately) in a free-form first message:
 * the words after "at" / "@" / "hospital:", or a clause naming a hospital.
 * "B negative 2 units at Medical College Kozhikode" -> Medical College Kozhikode.
 * "need O+ at KIMS in Trivandrum" -> KIMS, town Trivandrum. null if unsure.
 */
export function extractPlace(text: string): { hospital: string; town: string | null } | null {
    const rest = withoutKnownParts(text.replace(/\n/g, ' | '));
    // Clauses split at separators and at the place prepositions (kept as markers).
    const parts = rest.split(/\s*(?:\||;|,|\.(?=\s)|!|\?)\s*/).flatMap(p => p.split(/(?<![a-z])(?=(?:at|in|@|near|hospital\s*:|place\s*:|location\s*:)(?![a-z]))/i));
    type Part = { marker: string | null; words: string };
    const clauses: Part[] = parts.map(p => {
        const m = /^(at|in|@|near|hospital\s*:|place\s*:|location\s*:)\s*/i.exec(p);
        const words = clean((m ? p.slice(m[0].length) : p).replace(FILLER, ' '));
        return { marker: m ? m[1].toLowerCase().replace(/\s/g, '') : null, words };
    }).filter(c => /[a-zऀ-ॿഀ-ൿ]{2,}/i.test(c.words));
    if (!clauses.length) return null;

    const named = clauses.find(c => HOSPITAL_WORDS.test(c.words));
    const marked = clauses.find(c => c.marker && c.marker !== 'in');
    const hospital = named ?? marked ?? null;
    if (!hospital) return null;
    const town = clauses.find(c => c !== hospital && (c.marker === 'in' || c.marker === 'near' || (!c.marker && clauses.indexOf(c) > clauses.indexOf(hospital))) && c.words.split(' ').length <= 3) ?? null;
    const name = hospital.words.slice(0, 120);
    if (name.length < 3) return null;
    return { hospital: name, town: town && !name.toLowerCase().includes(town.words.toLowerCase()) ? town.words.slice(0, 60) : null };
}

/**
 * The answer to "Which hospital?": "Govt Medical College, Kozhikode",
 * "KIMS Trivandrum 695029", or just "673008". Splits off a PIN code and a town
 * after the last comma. Refuses links and text without letters.
 */
export function parseHospitalAnswer(text: string): { hospital: string | null; town: string | null; pin: string | null } | null {
    const t = text.replace(/\s+/g, ' ').trim();
    if (!t || t.length > 200 || /https?:|www\.|\.(?:com|in|org)\b/i.test(t)) return null;
    const pin = parsePin(t);
    const words = clean(t.replace(/(?<!\d)[1-9]\d{2}\s?\d{3}(?!\d)/, ' ').replace(/\b(?:pin(?:\s*code)?|pincode)\s*[:\-]?\s*$/i, ''));
    if (!/[a-zऀ-ॿഀ-ൿ]{2,}/i.test(words)) return pin ? { hospital: null, town: null, pin } : null;
    const comma = words.lastIndexOf(',');
    const hospital = clean(comma > 0 ? words.slice(0, comma) : words).slice(0, 120);
    const town = comma > 0 ? clean(words.slice(comma + 1)).slice(0, 60) || null : null;
    if (hospital.length < 3) return null;
    return { hospital, town, pin };
}

// Words that say what kind of place it is but not which one.
const GENERIC_PLACE = /^(?:govt|government|general|district|taluk|taluka|civil|city|medical|college|hospital|hosp|clinic|centre|center|health|blood|bank|institute|of|and|the|super|speciality|specialty|multi|nursing|home|private|mch|icu|ward|care|research|sciences?|memorial|mission|trust|charitable|main|new|old|st|saint|&)$/i;

/** True when the hospital name alone can't tell where it is ("Medical College", "Govt Hospital"). */
export function placeNeedsTown(hospital: string): boolean {
    return hospital.split(/[\s,.()]+/).filter(Boolean).every(w => GENERIC_PLACE.test(w));
}

/** A person's name as typed: letters (any script), spaces, . ' -; 2..60 chars. */
export function parseName(text: string): string | null {
    const t = text.replace(/\s+/g, ' ').trim();
    if (t.length < 2 || t.length > 60) return null;
    if (!/^[\p{L}\p{M}][\p{L}\p{M} .'’-]*$/u.test(t)) return null;
    return t;
}

// ---------------------------------------------------------------------------
// The draft
// ---------------------------------------------------------------------------

export type RequestStep = 'blood_group' | 'units' | 'hospital' | 'date' | 'contact_name' | 'contact_phone' | 'confirm' | 'edit';

export type PlaceMatch = {
    latitude: number;
    longitude: number;
    /** 'hospital': the hospital itself on the map; otherwise the centre of the PIN area, district or town. */
    precision: 'hospital' | 'pin' | 'district' | 'city';
    /** What the geocoder found, for the summary. */
    label: string;
    city: string | null;
    district: string | null;
    state: string | null;
    zipcode: string | null;
};

export type RequestDraft = {
    bloodGroup?: BloodGroup;
    units?: number;
    hospital?: string;
    town?: string | null;
    pin?: string | null;
    place?: PlaceMatch;
    dateNeeded?: string;
    contactName?: string;
    /** 10 digits. */
    contactPhone?: string;
    /** The sender's profile name, offered as the contact name. */
    profileName?: string | null;
    /** True while changing one field from the summary: go back to the summary after it. */
    editing?: boolean;
};

/** The order questions are asked in. */
export const STEPS: Exclude<RequestStep, 'confirm' | 'edit'>[] = ['blood_group', 'units', 'hospital', 'date', 'contact_name', 'contact_phone'];

/** The first question still unanswered, or 'confirm' when the draft is complete. */
export function nextStep(d: RequestDraft): RequestStep {
    if (!d.bloodGroup) return 'blood_group';
    if (!d.units) return 'units';
    if (!d.hospital || !d.place) return 'hospital';
    if (!d.dateNeeded) return 'date';
    if (!d.contactName) return 'contact_name';
    if (!d.contactPhone) return 'contact_phone';
    return 'confirm';
}

/** What the first message already tells us. */
export function parseFirstMessage(text: string, today: string): RequestDraft {
    const d: RequestDraft = {};
    const group = parseBloodGroup(text);
    if (group) d.bloodGroup = group;
    const units = parseUnits(text);
    if (units) d.units = units;
    const date = parseNeededBy(text, today);
    if (date && 'date' in date) d.dateNeeded = date.date;
    const place = extractPlace(text);
    const pin = parsePin(text);
    if (place) { d.hospital = place.hospital; d.town = place.town; }
    if (pin) d.pin = pin;
    return d;
}

/** "Needed by" as people say it: "today (Sun, 25 Oct)", "tomorrow (Mon, 26 Oct)", "Wed, 28 Oct". */
export function neededByLabel(date: string, today: string): string {
    const d = new Date(`${date}T00:00:00Z`);
    const label = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
    if (date === today) return `today (${label})`;
    if (date === addDays(today, 1)) return `tomorrow (${label})`;
    return label;
}

/** Same rule as the web form: needed today or tomorrow is urgent, within 3 days soon. */
export function urgencyFor(date: string, today: string): 'High' | 'Medium' | 'Low' {
    const days = daysBetween(today, date);
    return days <= 1 ? 'High' : days <= 3 ? 'Medium' : 'Low';
}
