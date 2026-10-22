import { supabase } from '../lib/supabase';
import { resolveRegion } from '../lib/india-regions';

/**
 * A completed registration: full name, state and district filled in. Same rule
 * as "members" in public.public_stats() (migration 20261018000300).
 *
 * Not the phone: it can be removed later when another account verifies the
 * same number (see migration 20261017000100). Settings then asks for a new one
 * instead of sending the person through registration again.
 *
 * Not the city either: it is no longer asked (profiles.city is now a copy of
 * the district). Older accounts registered with city and district but before
 * the state was asked: when their district names exactly one listed district,
 * its state is filled in here (their own row) and they count as complete, so
 * they aren't sent back through registration.
 */
export async function isRegistrationComplete(userId: string): Promise<boolean> {
    try {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('full_name, state, district')
            .eq('id', userId)
            .single();

        if (error) {
            console.error('Error fetching profile:', error);
            throw error;
        }

        if (!profile?.full_name?.trim() || !profile.district?.trim()) return false;
        if (profile.state?.trim()) return true;

        const { state } = resolveRegion(null, profile.district);
        if (!state) return false;
        // Best effort; the check passes either way.
        await supabase.from('profiles').update({ state }).eq('id', userId).then(() => {}, () => {});
        return true;
    } catch (error) {
        console.error('Error checking registration status:', error);
        return false;
    }
}

/**
 * Where a signed-in account stands:
 *   'complete'   finished donor registration (isRegistrationComplete)
 *   'requester'  not registered as a donor, but here to request blood: has
 *                posted a request, or chose "I only want to request blood"
 *                (user_metadata.account_type = 'requester'). Never sent
 *                through the donor form; they can still choose to register.
 *   'new'        neither yet: offered the (short) donor form, which they can skip.
 */
export type AccountStage = 'complete' | 'requester' | 'new';

export async function accountStage(userId: string, userMetadata?: Record<string, unknown> | null): Promise<AccountStage> {
    if (await isRegistrationComplete(userId)) return 'complete';
    if (userMetadata?.account_type === 'requester') return 'requester';
    const { count } = await supabase
        .from('blood_requests')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);
    return (count ?? 0) > 0 ? 'requester' : 'new';
}

/** Signed-in pages a requester-only account can open without registering as a donor. */
export const REQUESTER_PATHS = ['/requests', '/profile'];

/** Where to go right after signing in. `redirect` must already be a safe internal path. */
export async function pathAfterSignIn(userId: string, userMetadata?: Record<string, unknown> | null, redirect = ''): Promise<string> {
    // Requesting blood never needs a donor profile.
    if (redirect.startsWith('/requests')) return redirect;
    const stage = await accountStage(userId, userMetadata).catch((): AccountStage => 'new');
    if (stage === 'complete') return redirect || '/dashboard';
    if (stage === 'requester') return redirect && REQUESTER_PATHS.some(p => redirect.startsWith(p)) ? redirect : '/requests/my-requests';
    return '/complete-registration';
}
