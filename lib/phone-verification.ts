import { createHash, randomInt } from 'crypto';
import { whatsappEnabled } from '@/lib/whatsapp';

/**
 * Verifying a mobile number on WhatsApp without a template: the app shows a
 * code, the person sends "VERIFY <code>" to Vital's number, and the bot checks
 * the code and that the message came from the number on the profile.
 * Server only. See migration 20261017000100.
 */

export const PHONE_PURPOSE = 'phone_whatsapp';
export const PHONE_CODE_MINUTES = 15;
export const PHONE_CODE_MAX_ATTEMPTS = 5;

export const phoneCodeHash = (userId: string, code: string) =>
    createHash('sha256').update(`${PHONE_PURPOSE}:${userId}:${code}`).digest('hex');

export const newPhoneCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

/** Vital's WhatsApp number (digits) when the WhatsApp verification can be used. */
export function whatsappVerifyNumber() {
    const number = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '').replace(/\D/g, '');
    return whatsappEnabled() && number ? number : null;
}

/** "VERIFY 123456" (any case, spacing) -> "123456". */
export function parseVerifyMessage(text: string): string | null {
    const m = text.trim().match(/^verify\s*(\d{6})$/i);
    return m ? m[1] : null;
}

export { PHONE_TAKEN, isPhoneTakenError } from '@/lib/phone';
