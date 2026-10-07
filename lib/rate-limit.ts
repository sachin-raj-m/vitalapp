import { createHash } from 'node:crypto';
import { serviceClient } from '@/lib/supabase-route';

/**
 * Fixed-window rate limiter backed by Postgres (public.rate_limit_hit), so it
 * works across serverless instances without extra infrastructure.
 *
 * Fails open: if the database call errors (e.g. the migration isn't applied
 * yet), the request is allowed and the error is logged. These limits are abuse
 * brakes, not access control.
 */
export async function rateLimit(key: string, windowSeconds: number, max: number): Promise<boolean> {
    try {
        const { data, error } = await serviceClient().rpc('rate_limit_hit', {
            p_key: key,
            p_window_seconds: windowSeconds,
            p_max: max,
        });
        if (error) throw error;
        return data !== false;
    } catch (error) {
        console.error('rate limit check failed (allowing request):', error);
        return true;
    }
}

/** Checks every limit (each records a hit) and returns false if any is exceeded. */
export async function rateLimitAll(limits: Array<[key: string, windowSeconds: number, max: number]>): Promise<boolean> {
    const results = await Promise.all(limits.map(([key, w, m]) => rateLimit(key, w, m)));
    return results.every(Boolean);
}

/**
 * Client IP. On Vercel, x-real-ip / the first x-forwarded-for entry are set by
 * the platform edge and can't be spoofed by the client.
 */
export function clientIp(request: Request): string {
    const real = request.headers.get('x-real-ip')?.trim();
    if (real) return real;
    const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    return forwarded || 'unknown';
}

/** Stable, non-reversible key part for personal data such as e-mail addresses. */
export function hashKey(value: string): string {
    return createHash('sha256').update(value.trim().toLowerCase()).digest('hex').slice(0, 32);
}

export function tooManyRequests(retryAfterSeconds: number) {
    return Response.json(
        { error: 'Too many requests. Please wait a little and try again.' },
        { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
    );
}
