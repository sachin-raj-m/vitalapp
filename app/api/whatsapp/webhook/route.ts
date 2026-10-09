import { NextResponse } from 'next/server';
import { serviceClient } from '@/lib/supabase-route';
import { verifyWebhookSignature, waNumber } from '@/lib/whatsapp';
import { handleInbound } from '@/lib/whatsapp-bot';

// Needs Node's crypto and must never be cached.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Meta's one-time webhook verification (hub.challenge). */
export async function GET(request: Request) {
    const url = new URL(request.url);
    const expected = process.env.WHATSAPP_VERIFY_TOKEN;
    if (expected && url.searchParams.get('hub.mode') === 'subscribe' && url.searchParams.get('hub.verify_token') === expected) {
        return new Response(url.searchParams.get('hub.challenge') ?? '', { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }
    return new Response('Forbidden', { status: 403 });
}

type WaMessage = {
    from: string; id: string; type: string;
    text?: { body?: string };
    button?: { payload?: string; text?: string };
    interactive?: { type?: string; button_reply?: { id?: string } };
};
type WaStatus = { id: string; status: string; errors?: Array<{ title?: string }> };

/**
 * Incoming messages and delivery statuses. Signed by Meta with the app secret;
 * anything unsigned is rejected. Always answers 200 for signed requests (after
 * handling), because Meta retries non-200s; duplicates are skipped by message id.
 */
export async function POST(request: Request) {
    const raw = await request.text();
    if (!verifyWebhookSignature(raw, request.headers.get('x-hub-signature-256'))) {
        return new Response('Invalid signature', { status: 401 });
    }

    let body: any;
    try { body = JSON.parse(raw); } catch { return NextResponse.json({ ok: true }); }

    const admin = serviceClient();
    const values = (body?.entry ?? []).flatMap((e: any) => (e?.changes ?? []).map((c: any) => c?.value ?? {}));

    for (const value of values) {
        for (const s of (value.statuses ?? []) as WaStatus[]) {
            await admin.from('whatsapp_messages')
                .update({ status: s.status, error: s.errors?.[0]?.title?.slice(0, 300) ?? null, updated_at: new Date().toISOString() })
                .eq('wa_message_id', s.id);
        }

        for (const m of (value.messages ?? []) as WaMessage[]) {
            const from = waNumber(m.from) ?? m.from;
            // Record first; a duplicate id means Meta is retrying something already handled.
            const { error: dup } = await admin.from('whatsapp_messages').insert({
                direction: 'in', wa_message_id: m.id, wa_number: from, kind: m.type, status: 'received',
            });
            if (dup) {
                // 23505 = already handled (Meta retry). Anything else: log and skip
                // rather than risk handling the same message twice.
                if (dup.code !== '23505') console.error('WhatsApp inbound log failed', dup.message);
                continue;
            }

            const payload = m.button?.payload ?? m.interactive?.button_reply?.id;
            try {
                if (payload) await handleInbound({ from, kind: 'payload', value: payload });
                else if (m.type === 'text' && m.text?.body) await handleInbound({ from, kind: 'text', value: m.text.body });
                else await handleInbound({ from, kind: 'text', value: '' });
            } catch (error) {
                console.error('WhatsApp inbound handling failed', error);
            }
        }
    }
    return NextResponse.json({ ok: true });
}
