import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    const {
        data: { user },
        error,
    } = await supabase.auth.getUser()

    const path = request.nextUrl.pathname
    console.log(`[Middleware] ${request.method} ${path}`)
    console.log(`[Middleware] User ID: ${user?.id || 'None'}, Error: ${error?.message || 'None'}`)

    // Protected Routes
    const protectedPaths = [
        '/admin',
        '/profile',
        '/donations',
        '/requests/new',
        '/achievements',
    ]

    const isProtectedPath = protectedPaths.some(p => path.startsWith(p))

    // Auth Routes
    const authPaths = ['/login', '/register']
    const isAuthPath = authPaths.some(p => path.startsWith(p))

    if (isProtectedPath && !user) {
        console.log(`[Middleware] Redirecting unauthenticated user from ${path} to /login`)
        const redirectUrl = new URL('/login', request.url)
        redirectUrl.searchParams.set('redirect', path)
        return NextResponse.redirect(redirectUrl)
    }

    if (isAuthPath && user) {
        console.log(`[Middleware] Redirecting authenticated user from ${path} to /dashboard`)
        return NextResponse.redirect(new URL('/dashboard', request.url)) // Default logged-in home
    }

    return response
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
