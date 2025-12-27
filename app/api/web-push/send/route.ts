import { NextResponse } from 'next/server'
import webpush from 'web-push'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { getAll: () => cookieStore.getAll() } }
    )

    // 1. Authenticate caller (Must be logged in)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Parse Request
    const { subscription, userIds, title, body, url } = await request.json()

    if ((!subscription && (!userIds || userIds.length === 0)) || !title || !body) {
        return NextResponse.json({ error: 'Missing required fields (subscription OR userIds, title, body)' }, { status: 400 })
    }

    // 3. Setup VAPID
    webpush.setVapidDetails(
        process.env.VAPID_SUBJECT || 'mailto:admin@vitalapp.com',
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
        process.env.VAPID_PRIVATE_KEY!
    )

    const payload = JSON.stringify({ title, body, url })

    // 4. Determine Targets
    let targets: any[] = []

    if (subscription) {
        // Direct Send (Backward compatibility or single sub test)
        targets.push(subscription)
    } else if (userIds && userIds.length > 0) {

        // 5. Verify Admin Role for Bulk/Targeted Ops (Security)
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        if (profile?.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden: Admin access required for targeted push.' }, { status: 403 })
        }

        // 6. Fetch Subscriptions using SERVICE ROLE (Bypass RLS)
        // We need a Service Role client here because RLS prevents users from seeing other's subscriptions.
        // Assuming SUPABASE_SERVICE_ROLE_KEY is available in env.
        const serviceSupabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { cookies: { getAll: () => [] } } // No cookies needed for service role
        )

        const { data: subs, error } = await serviceSupabase
            .from('push_subscriptions')
            .select('subscription')
            .in('user_id', userIds)

        if (error) {
            console.error('Service Role Fetch Error:', error)
            return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 })
        }

        if (subs) {
            targets = subs.map(s => s.subscription)
        }
    }

    if (targets.length === 0) {
        // Return 200 with 0 sent if valid request but no active subs found (so client doesn't retry as error)
        return NextResponse.json({ success: true, sent: 0, failed: 0, message: 'No active subscriptions found for targets.' })
    }

    // 7. Send Notifications
    let sentCount = 0
    let failedCount = 0

    await Promise.all(targets.map(async (sub) => {
        try {
            await webpush.sendNotification(sub, payload)
            sentCount++
        } catch (error: any) {
            console.error('Push Send Error:', error)
            failedCount++
            // Optional: If 410 Gone, remove subscription from DB (requires storing endpoint)
        }
    }))

    return NextResponse.json({ success: true, sent: sentCount, failed: failedCount })
}
