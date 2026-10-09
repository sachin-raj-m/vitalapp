/**
 * Server-side Cloudflare Turnstile check, for routes that don't go through
 * Supabase Auth (password reset). Returns true when Turnstile isn't configured,
 * so the form keeps working until keys are set.
 */
export async function verifyTurnstile(token: unknown, ip?: string): Promise<boolean> {
    const secret = process.env.TURNSTILE_SECRET_KEY;
    if (!secret) return true;
    if (typeof token !== 'string' || !token || token.length > 2048) return false;
    try {
        const body = new URLSearchParams({ secret, response: token });
        if (ip && ip !== 'unknown') body.set('remoteip', ip);
        const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
        const data = await res.json().catch(() => null);
        return data?.success === true;
    } catch {
        // Cloudflare unreachable: don't lock people out of resetting their password.
        console.error('Turnstile verification unavailable');
        return true;
    }
}
