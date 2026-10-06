import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

/** Supabase client acting as the signed-in user (cookie session). */
export async function userClient() {
    const cookieStore = await cookies();
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll: () => cookieStore.getAll(),
                setAll: (toSet) => {
                    try {
                        toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
                    } catch {
                        // Called from a context that can't set cookies; middleware refreshes them.
                    }
                },
            },
        }
    );
}

/**
 * Returns the verified user. getUser() checks the JWT with Supabase; never use
 * getSession() for authorization on the server, since it trusts the cookie as-is.
 * Falls back to a Bearer token for clients that can't send cookies.
 */
export async function getVerifiedUser(request: Request) {
    const supabase = await userClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) return { supabase, user: data.user };

    const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '').trim();
    if (token) {
        const { data: tokenData } = await supabase.auth.getUser(token);
        if (tokenData.user) {
            const asUser = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
                global: { headers: { Authorization: `Bearer ${token}` } },
                auth: { persistSession: false, autoRefreshToken: false },
            });
            return { supabase: asUser, user: tokenData.user };
        }
    }
    return { supabase, user: null };
}

/** Service-role client. Server only; bypasses RLS, so authorize first. */
export function serviceClient() {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
}
