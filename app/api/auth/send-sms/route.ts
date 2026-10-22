import { NextResponse } from 'next/server';
import { serviceClient } from '@/lib/supabase-route';
import { rateLimit } from '@/lib/rate-limit';
import { waNumber } from '@/lib/phone';
import { sendText, whatsappEnabled } from '@/lib/whatsapp';
import {
    PHONE_LOGIN_MINUTES, encryptCode, loginCodeMessage, phoneLoginConfigured, verifyHookSignature,
} from '@/lib/phone-login';

// Needs Node's crypto and must never be cached.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Within this long of the person's last message, Vital may reply for free. */
const REPLY_WINDOW_MS = 23.5 * 3600_000;
/** Supabase gives the whole hook 5 seconds. */
const SEND_BUDGET_MS = 2500;

const hookError = (message: string, httpCode = 400) =>
    NextResponse.json({ error: { http_code: httpCode, message } }, { status: 400 });

/**
 * Supabase Auth "Send SMS" hook (lib/phone-login.ts). Vital has no SMS
 * provider: the code is kept, encrypted, until the person asks for it with
 * "LOGIN" on WhatsApp, or is sent straight away when they messaged Vital in
 * the last 24 hours.
 *
 * Signed with the hook secret (Standard Webhooks); unsigned calls get 401.
 * Answers 200 {} once the code is stored.
 */
export async function POST(request: Request) {
    if (!phoneLoginConfigured()) return hookError('Signing in with a mobile number isn’t available right now.', 503);

    const raw = await request.text();
    if (!verifyHookSignature(raw, request.headers)) {
        return NextResponse.json({ error: { http_code: 401, message: 'Invalid signature' } }, { status: 401 });
    }

    let body: any;
    try { body = JSON.parse(raw); } catch { return hookError('Invalid request'); }
    const otp = String(body?.sms?.otp ?? '');
    // A phone change sends the code to the new number. (user.id may not be
    // committed yet for a new account, so it's kept only as a note.)
    const wa = waNumber(body?.user?.new_phone || body?.user?.phone);
    const userId = typeof body?.user?.id === 'string' ? body.user.id : null;
    if (!/^\d{6,10}$/.test(otp)) return hookError('Invalid request');
    if (!wa) return hookError('Use a 10-digit Indian mobile number.');

    if (!(await rateLimit(`phone-login:${wa}`, 60 * 60, 10))) {
        return hookError('Too many codes for this number. Please wait an hour and try again.', 429);
    }

    const admin = serviceClient();
    const now = Date.now();
    await admin.from('phone_login_codes').delete().lt('expires_at', new Date(now).toISOString());
    const { error } = await admin.from('phone_login_codes').upsert({
        wa_number: wa,
        user_id: userId,
        code_enc: encryptCode(otp),
        expires_at: new Date(now + PHONE_LOGIN_MINUTES * 60_000).toISOString(),
        delivered_at: null,
        deliveries: 0,
        created_at: new Date(now).toISOString(),
    });
    if (error) {
        console.error('Phone sign-in code could not be stored', error.message);
        return hookError('Could not prepare your code. Please try again.', 500);
    }

    // Messaged Vital recently: the code can go out now as a free reply.
    if (whatsappEnabled()) {
        const { data: recent } = await admin.from('whatsapp_messages')
            .select('id')
            .eq('direction', 'in')
            .eq('wa_number', wa)
            .gte('created_at', new Date(now - REPLY_WINDOW_MS).toISOString())
            .limit(1)
            .maybeSingle();
        if (recent) {
            const sent = await Promise.race([
                sendText(wa, loginCodeMessage(otp), { kind: 'verify' }).catch(() => null),
                new Promise<null>(resolve => setTimeout(() => resolve(null), SEND_BUDGET_MS)),
            ]);
            if (sent) {
                await admin.from('phone_login_codes').update({ delivered_at: new Date().toISOString(), deliveries: 1 }).eq('wa_number', wa);
            }
        }
    }

    return NextResponse.json({});
}
