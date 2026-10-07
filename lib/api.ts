import { supabase } from './supabase';

/**
 * fetch() for this app's own API routes. The Supabase session lives in browser
 * storage (not cookies), so API routes only see the user via this bearer token.
 */
export async function authedFetch(url: string, init: RequestInit = {}) {
    const { data: { session } } = await supabase.auth.getSession();
    const headers = new Headers(init.headers);
    if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`);
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    return fetch(url, { ...init, headers });
}
