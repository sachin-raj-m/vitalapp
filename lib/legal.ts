/**
 * Bump this whenever the Privacy Notice changes materially. It is stored with
 * each user's consent so you can tell which version they agreed to.
 */
export const PRIVACY_VERSION = '2026-10-06';
export const LEGAL_UPDATED = '7 October 2026';
export const GRIEVANCE_EMAIL = 'sachin@vitalapp.in';

/** One-line platform position. Keep wording identical wherever it appears. */
export const PLATFORM_DISCLAIMER =
    'Vital only connects people. It does not arrange, verify or guarantee donations, and is not involved in any payment.';

/** Longer platform position for legal pages, forms and modals. */
export const PLATFORM_DISCLAIMER_LONG =
    'Vital is a free platform where people can post blood requests and voluntary donors can see and respond to them. Vital does not arrange, supervise, verify, promote or guarantee any donation, donor or request, and is not involved in any payment. Any contact or arrangement is entirely between the people involved, at their own discretion and responsibility, and blood is collected only by hospitals and licensed blood banks, which decide who can donate.';

/** The consent fields stored on a profile (and in auth user metadata) when someone ticks the consent box. */
export const consentStamp = () => ({
    consent_agreed: true as const,
    consent_at: new Date().toISOString(),
    consent_version: PRIVACY_VERSION,
});

export type ConsentFields = { consent_agreed?: boolean | null; consent_at?: string | null; consent_version?: string | null };

/**
 * Mirrors public.consent_is_recorded() in the database: consent counts once it
 * is agreed, timestamped and versioned. The database requires it before a
 * profile becomes a donor or posts a request.
 */
export const hasRecordedConsent = (c: ConsentFields | null | undefined) =>
    !!(c?.consent_agreed && c.consent_at && c.consent_version?.trim());

/**
 * Keep the earliest consent timestamp for the current policy version, so a
 * later form save doesn't overwrite when the person first agreed. A consent
 * given to an older version is replaced (that is a re-consent).
 */
export const earliestConsentAt = (...stamps: Array<{ consent_at?: string | null; consent_version?: string | null } | null | undefined>) => {
    const times = stamps
        .filter(s => s?.consent_at && s.consent_version === PRIVACY_VERSION && !Number.isNaN(Date.parse(s.consent_at)))
        .map(s => s!.consent_at as string)
        .sort((a, b) => Date.parse(a) - Date.parse(b));
    return times[0] ?? null;
};
