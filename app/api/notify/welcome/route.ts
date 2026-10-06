import { NextResponse } from 'next/server';
import { getWelcomeEmailHtml } from '@/lib/email-templates';
import { sendEmail } from '@/lib/email';
import { getVerifiedUser } from '@/lib/supabase-route';

/** Sends the welcome email to the signed-in user only (never an arbitrary address). */
export async function POST(request: Request) {
    const { user } = await getVerifiedUser(request);
    if (!user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only within the first hour of the account existing, so it can't be replayed.
    if (Date.now() - new Date(user.created_at).getTime() > 60 * 60 * 1000) {
        return NextResponse.json({ success: true, skipped: true });
    }

    try {
        const name = (user.user_metadata?.full_name as string | undefined) || user.email.split('@')[0];
        await sendEmail({ to: user.email, subject: 'Welcome to Vital', html: getWelcomeEmailHtml({ name }) });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Welcome email error', error);
        return NextResponse.json({ error: 'Could not send email' }, { status: 500 });
    }
}
