import { createHash, randomBytes } from 'crypto';
import { serviceClient } from '@/lib/supabase-route';
import { SITE_URL } from '@/lib/site';
import { REVEAL_MINUTES } from '@/lib/contact-link-constants';

/**
 * Short-lived links to the contact page (/c/<token>), sent on WhatsApp so phone
 * numbers never sit in a chat. Only a SHA-256 of the token is stored.
 *
 * A link must be opened within its lifetime. The contact details appear only
 * after a button press (so link previews and crawlers don't use it up), and stay
 * visible for REVEAL_MINUTES after that first press.
 */
export { REVEAL_MINUTES };

export type Viewer = 'donor' | 'requester';

export const hashToken = (token: string) => createHash('sha256').update(token, 'utf8').digest('hex');

export const isTokenShaped = (token: string) => /^[A-Za-z0-9_-]{32,64}$/.test(token);

/** Creates a link; returns the token (for template URL buttons) and the full URL. */
export async function createContactLink(donationId: string, viewer: Viewer, lifetimeMinutes: number) {
    const token = randomBytes(24).toString('base64url');
    const { error } = await serviceClient().from('contact_links').insert({
        token_hash: hashToken(token),
        donation_id: donationId,
        viewer,
        expires_at: new Date(Date.now() + lifetimeMinutes * 60_000).toISOString(),
    });
    if (error) throw error;
    return { token, url: `${SITE_URL}/c/${token}` };
}

export type ContactLinkRow = {
    id: string; donation_id: string; viewer: Viewer; expires_at: string; revealed_at: string | null;
};

/** The link if it can still be used, else a reason. */
export async function findContactLink(token: string): Promise<{ link: ContactLinkRow } | { reason: 'invalid' | 'expired' }> {
    if (!isTokenShaped(token)) return { reason: 'invalid' };
    const { data } = await serviceClient()
        .from('contact_links')
        .select('id, donation_id, viewer, expires_at, revealed_at')
        .eq('token_hash', hashToken(token))
        .maybeSingle();
    if (!data) return { reason: 'invalid' };
    const now = Date.now();
    const revealWindowOver = data.revealed_at && now - Date.parse(data.revealed_at) > REVEAL_MINUTES * 60_000;
    const neverOpenedAndExpired = !data.revealed_at && now > Date.parse(data.expires_at);
    if (revealWindowOver || neverOpenedAndExpired) return { reason: 'expired' };
    return { link: data as ContactLinkRow };
}
