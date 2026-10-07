import { NextResponse } from 'next/server'
import { getVerifiedUser } from '@/lib/supabase-route'
import { rateLimit, tooManyRequests } from '@/lib/rate-limit'

/** Saves the caller's push subscription (RLS: owner only). */
export async function POST(request: Request) {
    const { supabase, user } = await getVerifiedUser(request)
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const subscription = await request.json().catch(() => null)
    const endpoint = subscription?.endpoint
    if (
        typeof endpoint !== 'string' || !endpoint.startsWith('https://') || endpoint.length > 1000 ||
        typeof subscription?.keys?.p256dh !== 'string' || typeof subscription?.keys?.auth !== 'string' ||
        JSON.stringify(subscription).length > 4000
    ) {
        return NextResponse.json({ error: 'Invalid push subscription' }, { status: 400 })
    }

    if (!(await rateLimit(`push-sub:${user.id}`, 60 * 60, 20))) {
        return tooManyRequests(60 * 60)
    }

    const { error } = await supabase
        .from('push_subscriptions')
        .upsert(
            { user_id: user.id, subscription: { endpoint, expirationTime: subscription.expirationTime ?? null, keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth } } },
            { onConflict: 'user_id, subscription' }
        )

    if (error) {
        console.error('Error saving push subscription:', error)
        return NextResponse.json({ error: 'Could not save subscription' }, { status: 500 })
    }
    return NextResponse.json({ success: true })
}
