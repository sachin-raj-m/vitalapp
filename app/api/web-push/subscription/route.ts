import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    const subscription = await request.json()

    if (!subscription) {
        return NextResponse.json({ error: 'No subscription provided' }, { status: 400 })
    }

    const cookieStore = {
        getAll() {
            // @ts-ignore
            return request.cookies.getAll?.() || []
        },
        setAll(cookiesToSet: any[]) { },
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
                    // Not needed for simple data fetch/insert usually unless refreshing
                },
            },
        }
    )

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        // Upsert subscription
        const { error } = await supabase
            .from('push_subscriptions')
            .upsert({
                user_id: user.id,
                subscription: subscription
            }, { onConflict: 'user_id, subscription' }) // We made UNIQUE(user_id, subscription)

        if (error) {
            console.error('Error saving subscription:', error)
            return NextResponse.json({ error: 'Database error' }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error in subscription route:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
