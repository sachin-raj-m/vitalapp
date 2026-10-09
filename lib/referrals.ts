/**
 * Referrals: recognition only. A credited referral is worth REFERRAL_POINTS on
 * the Milestones page and has no exchange value.
 */
export const REFERRAL_POINTS = 25;

/** Codes look like ASHA482: 2-6 letters (or VITAL) and 3-6 digits. */
export const REFERRAL_CODE_RE = /^[A-Z]{2,6}[0-9]{3,6}$/;

export const normaliseReferralCode = (raw?: string | null) => {
    const code = (raw ?? '').trim().toUpperCase();
    return REFERRAL_CODE_RE.test(code) ? code : null;
};

export const referralPath = (code: string) => `/r/${code}`;

const STORAGE_KEY = 'referral';
// A link opened more than 30 days before registering doesn't count.
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** Remember a code from a referral link until the person finishes registering. */
export function rememberReferral(raw?: string | null) {
    const code = normaliseReferralCode(raw);
    if (!code) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ code, at: Date.now() })); } catch { /* storage blocked */ }
}

/** The remembered code, if any and still fresh. Removes it either way. */
export function takeReferral(): string | null {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
        localStorage.removeItem(STORAGE_KEY);
        if (!saved?.code || Date.now() - Number(saved.at) > MAX_AGE_MS) return null;
        return normaliseReferralCode(saved.code);
    } catch {
        return null;
    }
}

/** WhatsApp-style invite text. *text* renders bold in WhatsApp. */
export function buildReferralMessage(origin: string, code: string, bloodGroup?: string | null) {
    const intro = bloodGroup ? `I'm a ${bloodGroup} blood donor on Vital.` : `I'm a blood donor on Vital.`;
    return [
        `*${intro}*`,
        'It is a free, voluntary network that alerts nearby donors when someone needs blood. You only hear from it when your blood group is needed near you.',
        `Join here, it takes two minutes: ${origin.replace(/\/$/, '')}${referralPath(code)}`,
    ].join('\n\n');
}
