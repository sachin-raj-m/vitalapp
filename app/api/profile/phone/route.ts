import { NextResponse } from 'next/server';
import { createHash, randomInt } from 'crypto';
import { getVerifiedUser, serviceClient } from '@/lib/supabase-route';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';
import { TEMPLATES, sendTemplate, whatsappEnabled } from '@/lib/whatsapp';
import { formatWaNumber, waNumber } from '@/lib/phone';
import { PHONE_TAKEN, isPhoneTakenError } from '@/lib/phone-verification';

export const dynamic = 'force-dynamic';

const CODE_MINUTES = 10;
const MAX_ATTEMPTS = 5;

const hashCode = (userId: string, code: string) => createHash('sha256').update(`${userId}:${code}`).digest('hex');

/** The database refuses a number another account has verified (migration 20261017000100). */
const saveFailed = (error: { message?: string; hint?: string }) => isPhoneTakenError(error)
    ? NextResponse.json({ error: PHONE_TAKEN, taken: true }, { status: 409 })
    : NextResponse.json({ error: 'Could not save the number.' }, { status: 500 });

/** Whether another account has verified this number (checked before sending a code to it). */
async function takenByAnother(userId: string, wa: string) {
    const { data: holder } = await serviceClient().rpc('profile_for_wa', { p_wa: wa });
    if (!holder || holder === userId) return false;
    const { data } = await serviceClient().from('profiles').select('phone_verified_at').eq('id', holder as string).maybeSingle();
    return !!data?.phone_verified_at;
}

/**
 * Changing or confirming the signed-in user's phone number. SMS isn't
 * available, so the code goes by WhatsApp.
 *
 *   { action: 'start', phone }  -> { sent: true, to } (code sent on WhatsApp), or
 *                                  { saved: true } when WhatsApp is off: the number
 *                                  is saved unverified, as at registration.
 *   { action: 'confirm', code } -> { verified: true, phone }
 */
export async function POST(request: Request) {
    const { user } = await getVerifiedUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json().catch(() => null);
    const admin = serviceClient();

    if (body?.action === 'start') {
        const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
        const wa = waNumber(phone);
        if (!wa) return NextResponse.json({ error: 'Enter a 10-digit Indian mobile number.' }, { status: 400 });

        if (!whatsappEnabled()) {
            const { error } = await admin.from('profiles').update({ phone, phone_verified_at: null }).eq('id', user.id);
            if (error) return saveFailed(error);
            return NextResponse.json({ saved: true });
        }
        if (await takenByAnother(user.id, wa)) return saveFailed({ hint: 'phone_taken' });

        // Per user and per number, so nobody can flood a number with codes.
        if (!(await rateLimit(`phone-code:${user.id}`, 60 * 60, 5)) || !(await rateLimit(`phone-code-to:${wa}`, 60 * 60, 5))) {
            return tooManyRequests(60 * 60);
        }
        const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
        const { error } = await admin.from('phone_change_codes').upsert({
            user_id: user.id, new_phone: phone, code_hash: hashCode(user.id, code), attempts: 0,
            expires_at: new Date(Date.now() + CODE_MINUTES * 60_000).toISOString(), created_at: new Date().toISOString(),
        });
        if (error) return NextResponse.json({ error: 'Could not start verification.' }, { status: 500 });

        const id = await sendTemplate(wa, TEMPLATES.verifyCode, { body: [code], urlSuffix: { index: 0, value: code } }, { kind: 'verify', userId: user.id });
        if (!id) {
            // Code couldn't be sent (e.g. the code template isn't approved yet):
            // save the number unverified, as before WhatsApp codes existed.
            await admin.from('phone_change_codes').delete().eq('user_id', user.id);
            const { error: saveError } = await admin.from('profiles').update({ phone, phone_verified_at: null }).eq('id', user.id);
            if (saveError) return saveFailed(saveError);
            return NextResponse.json({ saved: true });
        }
        return NextResponse.json({ sent: true, to: formatWaNumber(wa), minutes: CODE_MINUTES });
    }

    if (body?.action === 'confirm') {
        const code = typeof body.code === 'string' ? body.code.trim() : '';
        const { data: row } = await admin.from('phone_change_codes').select('*').eq('user_id', user.id).maybeSingle();
        if (!row || Date.parse(row.expires_at) < Date.now()) {
            return NextResponse.json({ error: 'That code has expired. Send a new one.' }, { status: 410 });
        }
        if (row.attempts >= MAX_ATTEMPTS) {
            return NextResponse.json({ error: 'Too many wrong codes. Send a new one.' }, { status: 429 });
        }
        if (!/^\d{6}$/.test(code) || hashCode(user.id, code) !== row.code_hash) {
            await admin.from('phone_change_codes').update({ attempts: row.attempts + 1 }).eq('user_id', user.id);
            const left = MAX_ATTEMPTS - row.attempts - 1;
            return NextResponse.json({ error: left > 0 ? `That code isn’t right. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'Too many wrong codes. Send a new one.' }, { status: 400 });
        }
        // Save the number, then verify it the same way as a WhatsApp "VERIFY"
        // message does, so other accounts holding it unverified give it up.
        const { error } = await admin.from('profiles').update({ phone: row.new_phone }).eq('id', user.id);
        if (error) return saveFailed(error);
        const { data: result, error: confirmError } = await admin.rpc('confirm_phone_for', { p_user: user.id, p_wa: waNumber(row.new_phone) });
        if (confirmError || (result !== 'verified' && result !== 'already_verified')) {
            return result === 'taken' ? saveFailed({ hint: 'phone_taken' }) : NextResponse.json({ error: 'Could not verify the number.' }, { status: 500 });
        }
        await admin.from('phone_change_codes').delete().eq('user_id', user.id);
        return NextResponse.json({ verified: true, phone: row.new_phone });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
}
