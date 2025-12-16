import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
    const subscription = await request.json()

    if (!subscription) {
        return NextResponse.json({ error: 'No subscription provided' }, { status: 400 })
    }

    const cookieStore = await cookies()

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch {
                        // The `setAll` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing
                        // user sessions.
                    }
                },
            },
        }
    )

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        // Fallback: Try Authorization header
        const authHeader = request.headers.get('Authorization')
        if (authHeader) {
            const token = authHeader.replace('Bearer ', '')
            const { data: { user: headerUser }, error: headerError } = await supabase.auth.getUser(token)

            if (headerUser && !headerError) {
                // Recovered user from header
                // proceed with headerUser logic by re-assigning or just using it below?
                // Better to just let the upsert use headerUser.id if user is null

                // We need to re-assign or use a new variable. 
                // Let's refactor slightly to handle both standard variable.
                await upsertSubscription(supabase, headerUser.id, subscription);
                return NextResponse.json({ success: true })
            }
        }

        console.error('Push Subscription 401: User not found. Cookies present:', cookieStore.getAll().map(c => c.name).join(', '));
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        await upsertSubscription(supabase, user.id, subscription);
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error in subscription route:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

async function upsertSubscription(supabase: any, userId: string, subscription: any) {
    const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
            user_id: userId,
            subscription: subscription
        }, { onConflict: 'user_id, subscription' })

    if (error) {
        console.error('Error saving subscription:', error)
        throw error
    }
}

