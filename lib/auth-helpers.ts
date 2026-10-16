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
