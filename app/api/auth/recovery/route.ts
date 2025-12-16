import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getResetPasswordEmailHtml } from '@/lib/email-templates';

// We need SERVICE_ROLE_KEY to use admin.generateLink
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
    const { email } = await request.json();

    if (!email) {
        return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return NextResponse.json({ error: 'Service Role Key missing' }, { status: 500 });
    }

    try {
        // Generate the recovery link manually
        const { data, error } = await supabaseAdmin.auth.admin.generateLink({
            type: 'recovery',
            email: email,
            options: {
                redirectTo: `${request.headers.get('origin') || 'https://vitalapp.vercel.app'}/auth/callback?next=/dashboard/profile` // Redirect after reset flow
            }
        });

        if (error) throw error;

        const { user, properties } = data;
        const resetLink = properties?.action_link;

        if (!resetLink) {
            throw new Error('Failed to generate reset link');
        }

        // Send via Resend
        const RESEND_API_KEY = process.env.RESEND_API_KEY;
        if (RESEND_API_KEY) {
            const html = getResetPasswordEmailHtml({ resetLink });

            await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${RESEND_API_KEY}`
                },
                body: JSON.stringify({
                    from: 'Vital App <onboarding@resend.dev>',
                    to: email,
                    subject: 'Reset Your Password 🔒',
                    html: html
                })
            });
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Recovery error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
