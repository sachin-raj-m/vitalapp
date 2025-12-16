import { NextResponse } from 'next/server';
import { getWelcomeEmailHtml } from '@/lib/email-templates';
import { sendEmail } from '@/lib/email';

export async function POST(request: Request) {
    const { email, name } = await request.json();

    if (!email || !name) {
        return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    try {
        const html = getWelcomeEmailHtml({ name });

        await sendEmail({
            to: email,
            subject: 'Welcome to VitalApp! 👋',
            html
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Welcome email error', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
