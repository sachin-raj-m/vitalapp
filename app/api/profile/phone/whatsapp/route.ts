import { NextResponse } from 'next/server';
import { getVerifiedUser, serviceClient } from '@/lib/supabase-route';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';
import { formatWaNumber, waNumber } from '@/lib/phone';
import { PHONE_CODE_MINUTES, PHONE_PURPOSE, newPhoneCode, phoneCodeHash, whatsappVerifyNumber } from '@/lib/phone-verification';

export const dynamic = 'force-dynamic';

/**
 * Verifying the signed-in user's saved mobile number on WhatsApp. Vital can't
 * send the first message without an approved template, so the person sends
 * one instead: "VERIFY <code>" to Vital's number. lib/whatsapp-bot.ts checks
 * the code and that it came from this number, then marks it verified.
 *
 *   POST { action: 'start' } -> { code, link, number, to, minutes }, or { verified: true }
 *   GET                      -> { verified, released, waiting }  (the page polls this)
 */
export async function POST(request: Request) {
    const { user } = await getVerifiedUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json().catch(() => null);
    if (body?.action !== 'start') return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

    const number = whatsappVerifyNumber();
    if (!number) return NextResponse.json({ error: 'Verifying on WhatsApp isn’t available right now.', unavailable: true }, { status: 503 });

    const admin = serviceClient();
    const { data: profile } = await admin.from('profiles').select('phone, phone_verified_at').eq('id', user.id).maybeSingle();
    if (profile?.phone_verified_at) return NextResponse.json({ verified: true });
    const wa = waNumber(profile?.phone);
    if (!wa) return NextResponse.json({ error: 'Save a 10-digit Indian mobile number first.' }, { status: 400 });

    if (!(await rateLimit(`phone-wa-code:${user.id}`, 60 * 60, 10))) return tooManyRequests(60 * 60);

    const code = newPhoneCode();
    const { error } = await admin.from('verification_codes').upsert({
        user_id: user.id, purpose: PHONE_PURPOSE, payload: { wa }, code_hash: phoneCodeHash(user.id, code), attempts: 0,
        expires_at: new Date(Date.now() + PHONE_CODE_MINUTES * 60_000).toISOString(), created_at: new Date().toISOString(),
    });
    if (error) return NextResponse.json({ error: 'Could not start verification. Please try again.' }, { status: 500 });

    return NextResponse.json({
        code,
        number: `+${number}`,
        link: `https://wa.me/${number}?text=${encodeURIComponent(`VERIFY ${code}`)}`,
        to: formatWaNumber(wa),
        minutes: PHONE_CODE_MINUTES,
    });
}

export async function GET(request: Request) {
    const { user } = await getVerifiedUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const admin = serviceClient();
    const [{ data: profile }, { data: pending }] = await Promise.all([
        admin.from('profiles').select('phone_verified_at, phone_released_at').eq('id', user.id).maybeSingle(),
        admin.from('verification_codes').select('expires_at').eq('user_id', user.id).eq('purpose', PHONE_PURPOSE).maybeSingle(),
    ]);
    return NextResponse.json({
        verified: !!profile?.phone_verified_at,
        released: !!profile?.phone_released_at,
        waiting: !!pending && Date.parse(pending.expires_at) > Date.now(),
    });
}
