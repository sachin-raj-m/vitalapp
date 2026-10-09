import { createHmac, timingSafeEqual } from 'crypto';
import { serviceClient } from '@/lib/supabase-route';

/**
 * WhatsApp Cloud API (Meta). Server only.
 *
 * Messages Vital starts (alerts, follow-ups, thank-yous) must use templates
 * approved in Meta's WhatsApp Manager; their exact wording is in
 * docs/WHATSAPP.md. Replies within 24 hours of the person's last message can
 * be free-form text or buttons.
 *
 * Phone numbers are never put in a message. Contacts are shown on vitalapp.in
 * behind a short-lived link (lib/contact-links.ts).
 *
 * Env: WHATSAPP_ENABLED=true, WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID,
 * WHATSAPP_APP_SECRET (webhook signatures), WHATSAPP_VERIFY_TOKEN (webhook
 * setup), optional WHATSAPP_API_VERSION and WHATSAPP_TEMPLATE_LANG.
 */

export const TEMPLATES = {
    donorAlert: 'vital_donor_alert',
    offerReceived: 'vital_offer_received',
    donationFollowup: 'vital_donation_followup',
    donorThanks: 'vital_donor_thanks',
    requestCovered: 'vital_request_covered',
} as const;

export type MessageKind =
    | 'alert' | 'offer_received' | 'followup' | 'thanks' | 'covered' | 'reply';

export const whatsappEnabled = () =>
    process.env.WHATSAPP_ENABLED === 'true' && !!process.env.WHATSAPP_TOKEN && !!process.env.WHATSAPP_PHONE_NUMBER_ID;

export { waNumber } from '@/lib/phone';

/** Checks Meta's X-Hub-Signature-256 header against the raw request body. */
export function verifyWebhookSignature(rawBody: string, header: string | null, secret = process.env.WHATSAPP_APP_SECRET): boolean {
    if (!secret || !header?.startsWith('sha256=')) return false;
    const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
    const given = header.slice('sha256='.length);
    if (given.length !== expected.length) return false;
    return timingSafeEqual(Buffer.from(given, 'hex'), Buffer.from(expected, 'hex'));
}

type LogContext = { userId?: string | null; requestId?: string | null; donationId?: string | null; kind: MessageKind };

async function post(to: string, message: Record<string, unknown>, ctx: LogContext): Promise<string | null> {
    const admin = serviceClient();
    if (!whatsappEnabled()) {
        // Switched off: record what would have been sent, so flows can be tested end to end.
        await admin.from('whatsapp_messages').insert({
            direction: 'out', wa_number: to, user_id: ctx.userId ?? null, request_id: ctx.requestId ?? null,
            donation_id: ctx.donationId ?? null, kind: ctx.kind, status: 'disabled',
        });
        return null;
    }

    const version = process.env.WHATSAPP_API_VERSION || 'v21.0';
    let messageId: string | null = null;
    let error: string | null = null;
    try {
        const res = await fetch(`https://graph.facebook.com/${version}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to, ...message }),
        });
        const body = await res.json().catch(() => null);
        if (res.ok) messageId = body?.messages?.[0]?.id ?? null;
        else error = body?.error?.message?.slice(0, 300) || `HTTP ${res.status}`;
    } catch (e) {
        error = e instanceof Error ? e.message.slice(0, 300) : 'network error';
    }

    await admin.from('whatsapp_messages').insert({
        direction: 'out', wa_message_id: messageId, wa_number: to, user_id: ctx.userId ?? null,
        request_id: ctx.requestId ?? null, donation_id: ctx.donationId ?? null, kind: ctx.kind,
        status: error ? 'failed' : 'sent', error,
    });
    if (error) console.error(`WhatsApp ${ctx.kind} to ${to.slice(0, 4)}… failed: ${error}`);
    return messageId;
}

const text = (value: string) => ({ type: 'text', text: value });

/**
 * A template message. `body` fills {{1}}, {{2}}… in order. `quickReplies` sets
 * the payload of each quick-reply button (by position); `urlSuffix` fills the
 * dynamic part of a URL button.
 */
export function sendTemplate(
    to: string,
    name: string,
    opts: { body: string[]; quickReplies?: string[]; urlSuffix?: { index: number; value: string } },
    ctx: LogContext,
) {
    const components: Record<string, unknown>[] = [
        { type: 'body', parameters: opts.body.map(v => text(v || '-')) },
    ];
    opts.quickReplies?.forEach((payload, index) => {
        components.push({ type: 'button', sub_type: 'quick_reply', index: String(index), parameters: [{ type: 'payload', payload }] });
    });
    if (opts.urlSuffix) {
        components.push({ type: 'button', sub_type: 'url', index: String(opts.urlSuffix.index), parameters: [text(opts.urlSuffix.value)] });
    }
    return post(to, {
        type: 'template',
        template: { name, language: { code: process.env.WHATSAPP_TEMPLATE_LANG || 'en' }, components },
    }, ctx);
}

/** Free-form text. Only valid within 24 hours of the person's last message. */
export function sendText(to: string, body: string, ctx: LogContext) {
    return post(to, { type: 'text', text: { body, preview_url: false } }, ctx);
}

/** Up to three reply buttons. Only valid within 24 hours of the person's last message. */
export function sendButtons(to: string, body: string, buttons: Array<{ id: string; title: string }>, ctx: LogContext) {
    return post(to, {
        type: 'interactive',
        interactive: {
            type: 'button',
            body: { text: body },
            action: { buttons: buttons.slice(0, 3).map(b => ({ type: 'reply', reply: { id: b.id, title: b.title.slice(0, 20) } })) },
        },
    }, ctx);
}
