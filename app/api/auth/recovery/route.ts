import { NextResponse, after } from 'next/server';
import { SITE_URL } from '@/lib/site';
import { getResetPasswordEmailHtml } from '@/lib/email-templates';
import { sendEmail } from '@/lib/email';
import { serviceClient } from '@/lib/supabase-route';
import { clientIp, hashKey, rateLimitAll, tooManyRequests } from '@/lib/rate-limit';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Sends a password reset link through our SMTP. The response is identical
 * whether or not the account exists, and the lookup + send happen after the
 * response so timing doesn't reveal it either. Rate limits are applied before
 * any lookup, so a 429 says nothing about the account.
 */
export async function POST(request: Request) {
    const body = await request.json().catch(() => null);
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
        return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
    }

    // Per IP: 5 per 15 min, 20 per day. Per address: 3 per hour.
    const allowed = await rateLimitAll([
        [`recovery:ip:${clientIp(request)}`, 15 * 60, 5],
        [`recovery:ipday:${clientIp(request)}`, 24 * 60 * 60, 20],
        [`recovery:email:${hashKey(email)}`, 60 * 60, 3],
    ]);
    if (!allowed) return tooManyRequests(15 * 60);

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.error('Recovery: SUPABASE_SERVICE_ROLE_KEY is not set');
        return NextResponse.json({ error: 'Password reset is unavailable right now' }, { status: 500 });
    }

    after(async () => {
        try {
            const { data, error } = await serviceClient().auth.admin.generateLink({
                type: 'recovery',
                email,
                options: { redirectTo: `${SITE_URL}/auth/callback?next=/profile/edit` },
            });
            // No such account (or another auth error): send nothing.
            if (error || !data?.properties?.action_link) return;

            await sendEmail({
                to: email,
                subject: 'Reset your Vital password',
                html: getResetPasswordEmailHtml({ resetLink: data.properties.action_link }),
            });
        } catch (error) {
            console.error('Recovery error:', error);
        }
    });

    return NextResponse.json({ success: true });
}
