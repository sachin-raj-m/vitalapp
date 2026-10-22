/**
 * Plain-language messages for Supabase Auth errors when sending or checking a
 * one-time code (email or phone). Unknown errors keep a generic message rather
 * than showing raw server text.
 */
export type OtpErrorKind = 'rate' | 'wait' | 'captcha' | 'no_account' | 'unavailable' | 'invalid_address' | 'other';

export function otpError(message?: string | null): { kind: OtpErrorKind; text: string; waitSeconds?: number } {
    const m = (message || '').toLowerCase();
    // "For security purposes, you can only request this after 42 seconds."
    const wait = m.match(/after (\d+) seconds?/);
    if (wait) {
        const s = Number(wait[1]);
        return { kind: 'wait', waitSeconds: s, text: `A code was sent a moment ago. You can ask for a new one in ${s} seconds.` };
    }
    if (m.includes('rate limit') || m.includes('too many')) {
        return { kind: 'rate', text: 'Too many codes have been requested. Wait a few minutes and try again.' };
    }
    if (m.includes('captcha')) {
        return { kind: 'captcha', text: 'The security check didn’t go through. Wait a moment for it to finish (or reload the page), then try again.' };
    }
    if (m.includes('signups not allowed') || m.includes('user not found')) {
        return { kind: 'no_account', text: 'There’s no Vital account with this yet.' };
    }
    if (m.includes('provider') && (m.includes('disabled') || m.includes('unsupported') || m.includes('not enabled'))) {
        return { kind: 'unavailable', text: 'This way of signing in isn’t available right now. Please use another option.' };
    }
    if (m.includes('invalid') && (m.includes('phone') || m.includes('email'))) {
        return { kind: 'invalid_address', text: m.includes('phone') ? 'Enter a 10-digit Indian mobile number.' : 'Enter a valid email address.' };
    }
    if (m.includes('error sending') || m.includes('hook') || m.includes('sms')) {
        return { kind: 'other', text: 'We couldn’t send a code just now. Please try again in a minute.' };
    }
    if (message && message.length < 160 && !m.includes('database')) return { kind: 'other', text: message };
    return { kind: 'other', text: 'Something went wrong sending the code. Please try again.' };
}
