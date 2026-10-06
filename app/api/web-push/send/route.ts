import { NextResponse } from 'next/server'
import webpush from 'web-push'
import { getVerifiedUser, serviceClient } from '@/lib/supabase-route'

/**
 * Admin-only targeted push. The admin check runs in the database (is_admin()),
 * and `url` must be a path on this site so pushes can't be used for phishing.
 */
export async function POST(request: Request) {
    const { supabase, user } = await getVerifiedUser(request)
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: isAdmin } = await supabase.rpc('is_admin')
    if (!isAdmin) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { userIds, title, body, url } = await request.json().catch(() => ({}))
    if (!Array.isArray(userIds) || userIds.length === 0 || !title || !body) {
        return NextResponse.json({ error: 'userIds, title and body are required' }, { status: 400 })
    }
    if (url !== undefined && (typeof url !== 'string' || !url.startsWith('/') || url.startsWith('//'))) {
        return NextResponse.json({ error: 'url must be a path on this site, e.g. /requests' }, { status: 400 })
    }

    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
        return NextResponse.json({ error: 'Push is not configured' }, { status: 500 })
    }
    webpush.setVapidDetails(
        process.env.VAPID_SUBJECT || 'mailto:sachin@vitalapp.in',
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    )

    const { data: subs, error } = await serviceClient()
        .from('push_subscriptions')
        .select('subscription')
        .in('user_id', userIds)

    if (error) {
        console.error('Subscription fetch error:', error)
        return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 })
    }
    if (!subs?.length) {
        return NextResponse.json({ success: true, sent: 0, failed: 0, message: 'No active subscriptions found for targets.' })
    }

    const payload = JSON.stringify({ title, body, url: url || '/dashboard' })
    let sent = 0
    let failed = 0
    await Promise.all(subs.map(async s => {
        try {
            await webpush.sendNotification(s.subscription as any, payload)
            sent++
        } catch (err) {
            console.error('Push Send Error:', err)
            failed++
        }
    }))

    return NextResponse.json({ success: true, sent, failed })
}
