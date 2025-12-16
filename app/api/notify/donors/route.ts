import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import webpush from 'web-push'

// Helper for compatible blood groups
// O- can donate to everyone. O+ to positive. A- to A and AB. etc.
// For MVP, we might stick to Exact Match + O- (Universal Donor)
// Or just Exact Match as per user request context often implies simplifying.
// Let's do Exact Match to avoid spamming for now, unless O- where we are desperate.
// user: "only show the donation offeres with name and blood grp" - previous context

export async function POST(request: Request) {
    const { requestId, bloodGroup, hospitalName, city, urgencyLevel } = await request.json()

    if (!requestId || !bloodGroup) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
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
                        // Ignored
                    }
                },
            },
        }
    )

    try {
        // 1. Find matching donors
        // For now: Exact match OR donors who are O- (Universal) unless the need is O- (already covered)
        // Let's stick to Exact Match for simplicity + O- (Universal Angels)
        const groupsToNotify = [bloodGroup]
        if (bloodGroup !== 'O-') {
            groupsToNotify.push('O-')
        }

        const { data: donors, error: donorError } = await supabase
            .from('profiles')
            .select('id')
            .in('blood_group', groupsToNotify)
            .eq('is_donor', true)
        // .eq('city', city) // Optional: filter by city if you want geo-targeting immediately
        // For now, let's notify all matching donors to maximize response test

        if (donorError) throw donorError

        if (!donors || donors.length === 0) {
            return NextResponse.json({ message: 'No matching donors found', count: 0 })
        }

        const donorIds = donors.map(d => d.id)

        // 2. Fetch subscriptions for these donors
        const { data: subscriptions, error: subError } = await supabase
            .from('push_subscriptions')
            .select('subscription, user_id')
            .in('user_id', donorIds)

        if (subError) throw subError

        if (!subscriptions || subscriptions.length === 0) {
            return NextResponse.json({ message: 'Found donors but no push subscriptions', count: 0 })
        }

        // 3. Send Notifications
        webpush.setVapidDetails(
            process.env.VAPID_SUBJECT || 'mailto:admin@vitalapp.com',
            process.env.VAPID_PUBLIC_KEY!,
            process.env.VAPID_PRIVATE_KEY!
        )

        const payload = JSON.stringify({
            title: `URGENT: ${bloodGroup} Blood Needed!`,
            body: `Hospital: ${hospitalName}. ${urgencyLevel} Urgency. Tap to view.`,
            icon: '/icon-192x192.png',
            url: `/requests/${requestId}` // Deep link
        })

        const promises = subscriptions.map(sub =>
            webpush.sendNotification(sub.subscription as any, payload)
                .catch(err => {
                    if (err.statusCode === 410 || err.statusCode === 404) {
                        // Subscription expired, delete it
                        return supabase.from('push_subscriptions').delete().eq('user_id', sub.user_id)
                    }
                    console.error('Push error:', err)
                })
        )

        await Promise.all(promises)

        return NextResponse.json({
            success: true,
            matchedDonors: donorIds.length,
            notificationsSent: subscriptions.length
        })

    } catch (error: any) {
        console.error('Error in notify/donors:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
