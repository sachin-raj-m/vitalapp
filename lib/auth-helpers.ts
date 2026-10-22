import { supabase } from '../lib/supabase';
import { resolveRegion } from '../lib/india-regions';
import { safeInternalPath } from '../lib/site';

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

/**
 * Where someone was heading when they were asked to sign in or sign up (e.g.
 * /requests?offer=<id> from "I can donate"). Carried in ?redirect= and also
 * remembered here for the steps that lose the query string: the link in a
 * confirmation email, Google's redirect, a page reload. Kept for a day.
 */
const NEXT_KEY = 'vital_next';
const NEXT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
// Pages that are steps of signing in themselves; never somewhere to return to.
const SIGN_IN_STEPS = ['/login', '/register', '/forgot-password', '/complete-registration', '/auth'];

/** A safe internal path worth returning to after sign-in, or ''. */
export function cleanNext(path?: string | null): string {
    const safe = safeInternalPath(path, '');
    const pathname = safe.split(/[?#]/)[0];
    return safe && !SIGN_IN_STEPS.some(p => pathname === p || pathname.startsWith(`${p}/`)) ? safe : '';
}

export function rememberNext(path?: string | null) {
    const next = cleanNext(path);
    if (!next) return;
    try { localStorage.setItem(NEXT_KEY, JSON.stringify({ next, at: Date.now() })); } catch { /* storage blocked */ }
}

/** The remembered destination, if fresh. Removes it. */
export function takeNext(): string {
    try {
        const saved = JSON.parse(localStorage.getItem(NEXT_KEY) || 'null');
        localStorage.removeItem(NEXT_KEY);
        if (!saved?.next || Date.now() - Number(saved.at) > NEXT_MAX_AGE_MS) return '';
        return cleanNext(saved.next);
    } catch {
        return '';
    }
}

/** `path?redirect=<next>`, or just `path` when there is nowhere special to go. */
export function withRedirect(path: string, next?: string | null): string {
    const clean = cleanNext(next);
    return clean && clean !== '/dashboard' ? `${path}?redirect=${encodeURIComponent(clean)}` : path;
}

/** Where to go right after signing in. `redirect` must already be a safe internal path. */
export async function pathAfterSignIn(userId: string, userMetadata?: Record<string, unknown> | null, redirect = ''): Promise<string> {
    // Requesting blood never needs a donor profile.
    if (redirect.startsWith('/requests')) return redirect;
    const stage = await accountStage(userId, userMetadata).catch((): AccountStage => 'new');
    if (stage === 'complete') return redirect || '/dashboard';
    if (stage === 'requester') return redirect && REQUESTER_PATHS.some(p => redirect.startsWith(p)) ? redirect : '/requests/my-requests';
    return withRedirect('/complete-registration', redirect);
}

/**
 * Where to go after signing up to be a donor (the register page). Like
 * pathAfterSignIn, except an account that hasn't finished the donor form is
 * always offered it, even one that has only requested blood so far: they came
 * here to become a donor. An existing donor just carries on.
 */
export async function pathAfterSignUp(userId: string, redirect = ''): Promise<string> {
    if (await isRegistrationComplete(userId)) return redirect || '/dashboard';
    return withRedirect('/complete-registration', redirect);
}
