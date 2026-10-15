import { NextResponse } from 'next/server';
import { createHash, randomInt } from 'crypto';
import { getVerifiedUser, serviceClient } from '@/lib/supabase-route';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';
import { sendEmail } from '@/lib/email';
import { getBloodGroupCodeEmailHtml } from '@/lib/email-templates';
import { BLOOD_GROUPS, formatBloodGroup } from '@/lib/blood-compatibility';
import type { BloodGroup } from '@/types';

export const dynamic = 'force-dynamic';

const CODE_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const PURPOSE = 'blood_group_change';

const hashCode = (userId: string, code: string) => createHash('sha256').update(`${PURPOSE}:${userId}:${code}`).digest('hex');
const maskEmail = (email: string) => email.replace(/^(.)(.*)(@.*)$/, (_, a, b, c) => a + '•'.repeat(Math.min(b.length, 6)) + c);

/**
 * Changing a donor's blood group: allowed once after registration, and only
 * after entering a code emailed to the account. The database refuses direct
 * changes (see migration 20261015000100); this route applies the change with
 * the service role once the code checks out.
 *
 *   { action: 'start', bloodGroup }  -> { sent: true, to }  (code emailed)
 *   { action: 'confirm', code }      -> { changed: true, bloodGroup }
 */
export async function POST(request: Request) {
    const { user } = await getVerifiedUser(request);
    if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json().catch(() => null);
    const admin = serviceClient();

    const { data: profile } = await admin.from('profiles')
        .select('full_name, blood_group, blood_group_changed_at, is_donor')
        .eq('id', user.id).maybeSingle();
    if (!profile?.is_donor || !profile.blood_group) {
        return NextResponse.json({ error: 'Only registered donors can change their blood group.' }, { status: 400 });
    }
    if (profile.blood_group_changed_at) {
        return NextResponse.json({ error: 'You have already changed your blood group once. Contact Vital if it is still wrong.' }, { status: 409 });
    }

    if (body?.action === 'start') {
        const next = body.bloodGroup as BloodGroup;
        if (!BLOOD_GROUPS.includes(next)) return NextResponse.json({ error: 'Choose a blood group.' }, { status: 400 });
        if (next === profile.blood_group) return NextResponse.json({ error: 'That is already your blood group.' }, { status: 400 });
        if (!(await rateLimit(`blood-group-code:${user.id}`, 60 * 60, 3))) return tooManyRequests(60 * 60);

        const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
        const { error } = await admin.from('verification_codes').upsert({
            user_id: user.id, purpose: PURPOSE, payload: { blood_group: next }, code_hash: hashCode(user.id, code),
            attempts: 0, expires_at: new Date(Date.now() + CODE_MINUTES * 60_000).toISOString(), created_at: new Date().toISOString(),
        });
        if (error) return NextResponse.json({ error: 'Could not start the change. Please try again.' }, { status: 500 });

        try {
            await sendEmail({
                to: user.email,
                subject: `Your Vital code: ${code}`,
                html: getBloodGroupCodeEmailHtml({
                    name: (profile.full_name || '').trim().split(/\s+/)[0] || 'there',
                    code, from: formatBloodGroup(profile.blood_group), to: formatBloodGroup(next), minutes: CODE_MINUTES,
                }),
                essential: true,
            });
        } catch {
            await admin.from('verification_codes').delete().eq('user_id', user.id).eq('purpose', PURPOSE);
            return NextResponse.json({ error: 'Couldn’t send the code by email. Please try again later.' }, { status: 502 });
        }
        return NextResponse.json({ sent: true, to: maskEmail(user.email), minutes: CODE_MINUTES });
    }

    if (body?.action === 'confirm') {
        const code = typeof body.code === 'string' ? body.code.trim() : '';
        const { data: row } = await admin.from('verification_codes').select('*')
            .eq('user_id', user.id).eq('purpose', PURPOSE).maybeSingle();
        if (!row || Date.parse(row.expires_at) < Date.now()) {
            return NextResponse.json({ error: 'That code has expired. Send a new one.' }, { status: 410 });
        }
        if (row.attempts >= MAX_ATTEMPTS) return NextResponse.json({ error: 'Too many wrong codes. Send a new one.' }, { status: 429 });
        if (!/^\d{6}$/.test(code) || hashCode(user.id, code) !== row.code_hash) {
            await admin.from('verification_codes').update({ attempts: row.attempts + 1 }).eq('user_id', user.id).eq('purpose', PURPOSE);
            const left = MAX_ATTEMPTS - row.attempts - 1;
            return NextResponse.json({ error: left > 0 ? `That code isn’t right. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'Too many wrong codes. Send a new one.' }, { status: 400 });
        }

        const next = (row.payload as { blood_group?: string })?.blood_group;
        // Only if no change has been made in the meantime (one change per profile).
        const { data: updated, error } = await admin.from('profiles')
            .update({ blood_group: next, blood_group_previous: profile.blood_group, blood_group_changed_at: new Date().toISOString() })
            .eq('id', user.id).is('blood_group_changed_at', null)
            .select('blood_group').maybeSingle();
        await admin.from('verification_codes').delete().eq('user_id', user.id).eq('purpose', PURPOSE);
        if (error || !updated) return NextResponse.json({ error: 'Could not change your blood group.' }, { status: 409 });
        return NextResponse.json({ changed: true, bloodGroup: updated.blood_group });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
}
