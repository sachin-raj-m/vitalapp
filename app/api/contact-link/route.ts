import { NextResponse } from 'next/server';
import { serviceClient } from '@/lib/supabase-route';
import { findContactLink } from '@/lib/contact-links';
import { contactDetails, contactSummary } from '@/lib/contact-view';
import { clientIp, hashKey, rateLimit, tooManyRequests } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/** Reveals the contact behind a /c/<token> link (POST only, so previews can't). */
export async function POST(request: Request) {
    if (!(await rateLimit(`contact-link:${hashKey(clientIp(request))}`, 10 * 60, 20))) return tooManyRequests(10 * 60);

    const body = await request.json().catch(() => null);
    const token = typeof body?.token === 'string' ? body.token : '';
    const found = await findContactLink(token);
    if ('reason' in found) return NextResponse.json({ error: found.reason }, { status: 410, headers: { 'Cache-Control': 'no-store' } });

    const summary = await contactSummary(found.link);
    if (!summary?.open) return NextResponse.json({ error: 'closed' }, { status: 410, headers: { 'Cache-Control': 'no-store' } });

    if (!found.link.revealed_at) {
        await serviceClient().from('contact_links').update({ revealed_at: new Date().toISOString() }).eq('id', found.link.id);
    }
    const details = await contactDetails(found.link, summary);
    return NextResponse.json(details, { headers: { 'Cache-Control': 'no-store' } });
}
