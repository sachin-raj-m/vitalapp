/**
 * An account is fully verified when its email is confirmed AND its mobile
 * number is verified; otherwise it is "pending verification". Used by the
 * banner and the admin page, so both mean the same thing.
 *
 * profiles.verification_status is separate: the admin's own review of a donor.
 */
export type ContactVerification = {
    email: boolean;
    phone: boolean;
    /** No number on the profile (never entered, or released to the account that verified it). */
    phoneMissing: boolean;
    pending: boolean;
};

export function contactVerification(profile: {
    email_verified_at?: string | null;
    phone?: string | null;
    phone_verified_at?: string | null;
} | null | undefined, emailConfirmedAt?: string | null): ContactVerification {
    const email = !!(emailConfirmedAt ?? profile?.email_verified_at);
    const phone = !!profile?.phone && !!profile?.phone_verified_at;
    return { email, phone, phoneMissing: !profile?.phone, pending: !email || !phone };
}
