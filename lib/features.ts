/**
 * Client-visible feature switches. Set NEXT_PUBLIC_WHATSAPP_ENABLED=true in
 * Vercel together with WHATSAPP_ENABLED (server) when WhatsApp goes live.
 */
export const WHATSAPP_LIVE = process.env.NEXT_PUBLIC_WHATSAPP_ENABLED === 'true';
