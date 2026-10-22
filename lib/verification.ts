/**
 * An account is verified when its email is confirmed OR its mobile number is
 * verified (on WhatsApp, or by signing in with the number). Only when neither
 * is done is it "pending verification". Used by the banner and the admin
 * page, so both mean the same thing; admin_insights() counts the same rule
 * (people.contact_verified, migration 20261022000100).
 *
 * profiles.verification_status is separate: the admin's own review of a donor.
 */
export type ContactVerification = {
    email: boolean;
    phone: boolean;
    /** No number on the profile (never entered, or released to the account that verified it). */
    phoneMissing: boolean;
    /** The account has no email at all (made by signing in with a mobile number). */
    emailMissing: boolean;
    /** Neither the email nor the mobile number is verified. */
    pending: boolean;
};

export function contactVerification(profile: {
    email?: string | null;
    email_verified_at?: string | null;
    phone?: string | null;
    phone_verified_at?: string | null;
} | null | undefined, emailConfirmedAt?: string | null): ContactVerification {
    const email = !!(emailConfirmedAt ?? profile?.email_verified_at);
    const phone = !!profile?.phone && !!profile?.phone_verified_at;
    return {
        email,
        phone,
        phoneMissing: !profile?.phone,
        emailMissing: !email && !profile?.email?.trim(),
        pending: !email && !phone,
    };
}
