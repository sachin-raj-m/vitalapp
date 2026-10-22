import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Refreshes a cookie-based Supabase session if one exists.
 *
 * Route protection is deliberately NOT done here: the browser client
 * (lib/supabase.ts, supabase-js createClient) keeps the session in
 * localStorage, so the server never sees a session cookie and a cookie gate
 * would bounce every signed-in user to /login. Private pages are guarded
 * client-side by ProtectedRoute, and every private read/write is enforced by
 * RLS and by getVerifiedUser() in API routes, which is where security lives.
 * To gate pages here, first move the browser client to @supabase/ssr's
 * createBrowserClient (cookie storage).
 */
export async function middleware(request: NextRequest) {
    // Nothing to refresh without a Supabase auth cookie; skip the auth call.
    if (!request.cookies.getAll().some(c => c.name.startsWith('sb-') && c.name.includes('-auth-token'))) {
        return NextResponse.next({ request })
    }

    let response = NextResponse.next({ request })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    response = NextResponse.next({ request })
                    cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
                },
            },
        }
    )

    // getUser() validates the JWT with Supabase and refreshes it when needed.
    await supabase.auth.getUser()

    // No redirect away from /login or /register here: a leftover cookie session
    // the browser client doesn't have would bounce /login -> /dashboard ->
    // /login forever, and it would drop ?redirect=. The pages themselves send
    // signed-in people on (lib/auth-helpers.ts pathAfterSignIn / pathAfterSignUp).
    return response
}

export const config = {
    matcher: [
        // Everything except static assets, the service worker and the manifest.
        '/((?!_next/static|_next/image|favicon.ico|sw.js|custom-sw.js|manifest.json|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
    ],
}
