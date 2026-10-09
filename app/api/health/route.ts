import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

/**
 * Health check for the uptime workflow (.github/workflows/uptime.yml): the app
 * is up and can read from the database with the public key. Also keeps the
 * free Supabase project from pausing. Returns no data, only ok/failed.
 */
export async function GET() {
    const started = Date.now();
    let db = false;
    try {
        const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
            auth: { persistSession: false, autoRefreshToken: false },
        });
        const { error } = await Promise.race([
            supabase.rpc('public_stats'),
            new Promise<{ error: Error }>(resolve => setTimeout(() => resolve({ error: new Error('timeout') }), 8000)),
        ]);
        db = !error;
    } catch {
        db = false;
    }
    return NextResponse.json(
        { ok: db, db: db ? 'ok' : 'failed', ms: Date.now() - started },
        { status: db ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
    );
}
