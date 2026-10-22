import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';

/**
 * Signing in with a mobile number, codes delivered on WhatsApp (no SMS).
 * Server only.
 *
 *   1. The app calls supabase.auth.signInWithOtp({ phone }).
 *   2. Supabase Auth calls the "Send SMS" hook (/api/auth/send-sms) with the
 *      code. The hook keeps it encrypted in phone_login_codes for a few
 *      minutes, and sends it at once if the number messaged Vital in the last
 *      24 hours (a free reply needs no template).
 *   3. Otherwise the person sends "LOGIN" to Vital on WhatsApp; the bot
 *      replies with the code. Only the holder of the number can do that.
 *   4. The app calls supabase.auth.verifyOtp({ phone, token, type: 'sms' }).
 *
 * See migration 20261022000100_phone_sign_in.sql.
 */

/** How long a code can be fetched. Supabase's SMS OTP expiry should be at least this. */
export const PHONE_LOGIN_MINUTES = 10;
/** LOGIN replies per code. */
export const PHONE_LOGIN_MAX_DELIVERIES = 5;

const hookSecret = () => process.env.SEND_SMS_HOOK_SECRET || '';

export const phoneLoginConfigured = () => !!hookSecret();

/** "LOGIN", "log in", "Sign in", "code", "OTP" -> true. */
export function isLoginMessage(text: string): boolean {
    return /^(log\s*-?\s*in|sign\s*-?\s*in|code|otp)[.!]?$/i.test(text.trim());
}

const key = () => createHash('sha256').update(`vital-phone-login:${hookSecret()}`).digest();

/** AES-256-GCM; "iv.tag.ciphertext" in base64url. */
export function encryptCode(code: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key(), iv);
    const ct = Buffer.concat([cipher.update(code, 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), ct].map(b => b.toString('base64url')).join('.');
}

export function decryptCode(value: string): string | null {
    try {
        const [iv, tag, ct] = value.split('.').map(p => Buffer.from(p, 'base64url'));
        const decipher = createDecipheriv('aes-256-gcm', key(), iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
    } catch {
        return null;
    }
}

/**
 * Standard Webhooks signature check, as Supabase Auth hooks sign them:
 * HMAC-SHA256 over "<webhook-id>.<webhook-timestamp>.<body>" with the
 * base64 secret after "v1,whsec_"; the header lists "v1,<base64>" signatures.
 * Rejects timestamps more than 5 minutes off.
 */
export function verifyHookSignature(rawBody: string, headers: Headers, secret = hookSecret(), now = Date.now()): boolean {
    const id = headers.get('webhook-id');
    const timestamp = headers.get('webhook-timestamp');
    const signatures = headers.get('webhook-signature');
    if (!secret || !id || !timestamp || !signatures) return false;
    const ts = Number(timestamp);
    if (!Number.isFinite(ts) || Math.abs(now / 1000 - ts) > 5 * 60) return false;

    const base64 = secret.replace(/^v1,/, '').replace(/^whsec_/, '');
    const expected = createHmac('sha256', Buffer.from(base64, 'base64')).update(`${id}.${timestamp}.${rawBody}`, 'utf8').digest();
    return signatures.split(' ').some(entry => {
        const [version, sig] = entry.split(',');
        if (version !== 'v1' || !sig) return false;
        const given = Buffer.from(sig, 'base64');
        return given.length === expected.length && timingSafeEqual(given, expected);
    });
}

export const loginCodeMessage = (code: string) =>
    `${code} is your Vital sign-in code. Enter it on the Vital page you came from. It works for ${PHONE_LOGIN_MINUTES} minutes.\n\nNever share this code. Vital will never ask you for it.`;
