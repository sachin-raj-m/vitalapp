import { NextResponse } from 'next/server';
import { getWelcomeEmailHtml } from '@/lib/email-templates';

export async function POST(request: Request) {
    const { email, name } = await request.json();

    if (!email || !name) {
        return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) {
        return NextResponse.json({ error: 'Resend API Key missing' }, { status: 500 });
    }

    try {
        const html = getWelcomeEmailHtml({ name });

        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${RESEND_API_KEY}`
            },
            body: JSON.stringify({
                from: 'Vital App <onboarding@resend.dev>',
                to: email,
                subject: 'Welcome to VitalApp! 👋',
                html: html
            })
        });

        if (!res.ok) {
            console.error('Welcome email failed', await res.text());
            return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Welcome email error', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
