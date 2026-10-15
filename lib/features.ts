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
