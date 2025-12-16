import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    // if "next" is in param, use it as the redirect URL
    const next = searchParams.get('next') ?? '/dashboard'

    if (code) {
        const cookieStore = {
            getAll() {
                // @ts-ignore
                return request.cookies.getAll?.() || []
            },
            setAll(cookiesToSet: any[]) {
                // This is a temporary store, the actual setting happens in response
            },
        }

        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() {
                        // @ts-ignore
                        return request.cookies.getAll()
                    },
                    setAll(cookiesToSet) {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            request.cookies.set(name, value)
                        )
                    },
                },
            }
        )

        // Exchange code for session
        const { error } = await supabase.auth.exchangeCodeForSession(code)

        if (!error) {
            // Check if we need to redirect to complete registration
            // For now, simple redirect to intended page
            // Note: To properly set cookies in the Browser, we must create a response
            // and apply the cookies to it.
            // The createServerClient above doesn't automatically mutate a response object here.
            // We need to capture the cookies and set them on the response.
        }
    }

    // Proper implementation with response manipulation
    // Re-creating client to capture cookie operations onto response
    const response = NextResponse.redirect(`${origin}${next}`)

    if (code) {
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() {
                        // @ts-ignore
                        return request.cookies.getAll()
                    },
                    setAll(cookiesToSet) {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            request.cookies.set(name, value)
                        )
                        cookiesToSet.forEach(({ name, value, options }) =>
                            response.cookies.set(name, value, options)
                        )
                    },
                },
            }
        )
        await supabase.auth.exchangeCodeForSession(code)
    }

    return response
}
