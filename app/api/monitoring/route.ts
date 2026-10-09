import { NextResponse } from 'next/server';
import { SENTRY_DSN } from '@/lib/monitoring';
import { clientIp, hashKey, rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Tunnel for browser error reports: the browser posts Sentry envelopes here and
 * we forward them to our own GlitchTip project only (never another DSN). Keeps
 * the CSP at 'self' and reports reach us even with tracker blockers.
 */
export async function POST(request: Request) {
    if (!SENTRY_DSN) return new Response(null, { status: 204 });
    if (!(await rateLimit(`monitoring:${hashKey(clientIp(request))}`, 60, 30))) return new Response(null, { status: 429 });

    const envelope = await request.text();
    if (envelope.length > 200_000) return new Response(null, { status: 413 });

    try {
        const header = JSON.parse(envelope.split('\n')[0] || '{}');
        const ours = new URL(SENTRY_DSN);
        const theirs = new URL(header.dsn);
        if (theirs.host !== ours.host || theirs.pathname !== ours.pathname) {
            return NextResponse.json({ error: 'Unknown project' }, { status: 400 });
        }
        const projectId = ours.pathname.replace(/^\//, '');
        const res = await fetch(`${ours.protocol}//${ours.host}/api/${projectId}/envelope/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-sentry-envelope' },
            body: envelope,
        });
        return new Response(null, { status: res.status });
    } catch {
        return NextResponse.json({ error: 'Invalid envelope' }, { status: 400 });
    }
}
