#!/usr/bin/env node
// Emails people whose Vital profile isn't complete (no name, state or district:
// the rule in lib/auth-helpers.ts isRegistrationComplete) and asks them to
// finish it. Only addresses that have been confirmed are emailed.
// Run scripts/normalize-regions.ts --apply first: it fills in the state of
// older profiles whose district names one listed district, which the app
// counts as complete.
//
//   node --env-file=.env scripts/remind-incomplete-profiles.mjs              (dry run: counts only)
//   node --env-file=.env scripts/remind-incomplete-profiles.mjs --test you@example.com
//   node --env-file=.env scripts/remind-incomplete-profiles.mjs --apply
//
// Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SMTP_* (never printed).
// Output is counts only (no names or addresses). Sends one at a time, 2 s apart.

import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const argv = process.argv.slice(2);
const apply = argv.includes('--apply');
const testTo = argv.includes('--test') ? argv[argv.indexOf('--test') + 1] : null;
if (argv.includes('--test') && !testTo) {
    console.error('Usage: --test <email>');
    process.exit(2);
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://vitalapp.in';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
});

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const blank = (v) => !v || !String(v).trim();

const subject = 'Finish your Vital profile so we can reach you';
const html = (name) => {
    const p = 'margin: 0 0 16px 0; color: #1f2937; font-size: 16px; line-height: 26px;';
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${subject}</title></head>
<body style="margin: 0; padding: 0; background-color: #fafaf9; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"><tr><td align="center" style="padding: 40px 16px;">
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; background-color: #ffffff; border: 1px solid #e7e5e4; border-radius: 12px;">
      <tr><td style="padding: 36px 32px;">
        <p style="${p}">Hi ${escapeHtml(name || 'there')},</p>
        <p style="${p}">Thank you for signing up to Vital. Your profile isn't finished yet, so we can't alert you when someone near you needs blood.</p>
        <p style="${p}">It takes about two minutes: your blood group, your state and district, your PIN code, and where we should alert you from. Your number is never shown to anyone until you offer to help.</p>
        <p style="margin: 8px 0 24px 0;">
          <a href="${SITE_URL}/login" style="background-color: #111827; color: #ffffff; display: inline-block; padding: 12px 22px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">Finish my profile</a>
        </p>
        <p style="${p}">Thank you,<br>Sachin<br><span style="color: #6b7280;">Vital</span></p>
        <p style="margin: 24px 0 0 0; color: #6b7280; font-size: 13px; line-height: 20px;">
          You're getting this once because you created an account on vitalapp.in. If you'd rather not be part of Vital,
          you can delete your account from your Profile page after signing in.
        </p>
      </td></tr>
    </table>
  </td></tr></table>
</body>
</html>`;
};

const transporter = () => nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});
const from = `Vital App <${process.env.SMTP_FROM || process.env.SMTP_USER}>`;

if (testTo) {
    await transporter().sendMail({ from, to: testTo, subject, html: html('Sachin') });
    console.log('test email sent');
    process.exit(0);
}

const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, state, district, email_verified_at');
if (error) {
    console.error('Could not read profiles:', error.message);
    process.exit(1);
}

const incomplete = profiles.filter(p => blank(p.full_name) || blank(p.state) || blank(p.district));
const reachable = incomplete.filter(p => p.email && p.email_verified_at);
console.log(`incomplete profiles: ${incomplete.length}, with a confirmed email: ${reachable.length}`);
if (!apply) {
    console.log('dry run: nothing sent (use --apply to send)');
    process.exit(0);
}

const t = transporter();
let sent = 0, failed = 0;
for (const p of reachable) {
    try {
        await t.sendMail({ from, to: p.email, subject, html: html((p.full_name || '').trim().split(/\s+/)[0]) });
        sent++;
    } catch {
        failed++;
    }
    await new Promise(r => setTimeout(r, 2000));
}
console.log(`sent: ${sent}, failed: ${failed}`);
