/**
 * Client-visible feature switches. Set NEXT_PUBLIC_WHATSAPP_ENABLED=true in
 * Vercel together with WHATSAPP_ENABLED (server) when WhatsApp goes live.
 */
export const WHATSAPP_LIVE = process.env.NEXT_PUBLIC_WHATSAPP_ENABLED === 'true';

/**
 * Vital's WhatsApp number in international format, digits only (e.g.
 * 15556628667). When set, people can verify their mobile number by sending
 * "VERIFY <code>" to it; this needs no message template, so it works before
 * the templates are approved. Empty = the option is hidden.
 */
export const WHATSAPP_VERIFY_NUMBER = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '').replace(/\D/g, '');

/**
 * "Continue with WhatsApp": sign in or create an account with just a mobile
 * number, the code fetched by sending LOGIN to Vital on WhatsApp
 * (lib/phone-login.ts). Hidden unless NEXT_PUBLIC_PHONE_SIGNIN=true AND
 * Vital's WhatsApp number is set; it also needs Supabase phone auth with the
 * Send SMS hook pointed at /api/auth/send-sms.
 */
export const PHONE_SIGNIN = process.env.NEXT_PUBLIC_PHONE_SIGNIN === 'true' && !!WHATSAPP_VERIFY_NUMBER;
