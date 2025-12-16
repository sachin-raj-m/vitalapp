import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getResetPasswordEmailHtml } from '@/lib/email-templates';
import { sendEmail } from '@/lib/email';

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

        // Send via Zoho SMTP
        const html = getResetPasswordEmailHtml({ resetLink });

        await sendEmail({
            to: email,
            subject: 'Reset Your Password 🔒',
            html
        });

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Recovery error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
