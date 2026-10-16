// Network totals for the public pages, from public.public_stats().
// Definitions of each number: supabase/migrations/20261017000500_public_stats.sql,
// members and districts as redefined in 20261018000300_district_not_city.sql.

import { createClient } from '@supabase/supabase-js';

export interface PublicStats {
    /** Accounts with a completed registration. */
    members: number;
    /** Registered donors with a blood group. */
    donors: number;
    /** Donors currently marked available (self-declared). */
    available_donors: number;
    /** Distinct donor districts (state + district). */
    districts: number;
    /** Old name for `districts` (same value since 20261018000300). */
    cities: number;
    /** Active and not past the needed-by date. */
    open: number;
    fulfilled: number;
    /** Requests with at least one completed donation. */
    requests_with_donation: number;
    /** Fulfilled, or with at least one completed donation. */
    requests_helped: number;
    /** Donations confirmed with the donor's PIN. */
    donations_completed: number;
    units_donated: number;
}

/** How long the pages reuse one result, in seconds. Keep in step with `revalidate` on the pages. */
export const PUBLIC_STATS_REVALIDATE = 300;

const KEYS: (keyof PublicStats)[] = [
    'members', 'donors', 'available_donors', 'districts', 'cities', 'open', 'fulfilled',
    'requests_with_donation', 'requests_helped', 'donations_completed', 'units_donated',
];

/** Normalises the RPC result; anything missing or malformed becomes 0. Null when there is no data at all. */
export function parsePublicStats(data: unknown): PublicStats | null {
    if (!data || typeof data !== 'object') return null;
    const raw = data as Record<string, unknown>;
    const out = {} as PublicStats;
    for (const k of KEYS) {
        const n = Number(raw[k]);
        out[k] = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    }
    // A database from before 20261018000300 only sends `cities`.
    if (raw.districts === undefined) out.districts = out.cities;
    return out;
}

/** Indian digit grouping: 1,23,456. */
export const formatCount = (n: number) => Math.round(n).toLocaleString('en-IN');

/**
 * Server-side fetch, cached by Next for PUBLIC_STATS_REVALIDATE seconds so the
 * database is asked at most once per window, not once per page view.
 * Returns null if Supabase isn't configured or the call fails.
 */
export async function fetchPublicStats(): Promise<PublicStats | null> {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    try {
        const supabase = createClient(url, key, {
            auth: { persistSession: false, autoRefreshToken: false },
            global: {
                fetch: (input, init) =>
                    fetch(input, { ...init, next: { revalidate: PUBLIC_STATS_REVALIDATE, tags: ['public-stats'] } }),
            },
        });
        // GET (the function is STABLE) so the request is a plain cacheable read.
        const { data, error } = await supabase.rpc('public_stats', {}, { get: true });
        return error ? null : parsePublicStats(data);
    } catch {
        return null;
    }
}
