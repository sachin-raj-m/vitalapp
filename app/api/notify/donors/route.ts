import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import webpush from 'web-push'

// Medical Compatibility Rules for Donors
// Key: Patient Blood Group (Recipient)
// Value: List of Compatible Donor Blood Groups
// Source: Red Cross
const COMPATIBLE_DONORS: Record<string, string[]> = {
    'A+': ['A+', 'A-', 'O+', 'O-'],
    'O+': ['O+', 'O-'],
    'B+': ['B+', 'B-', 'O+', 'O-'],
    'AB+': ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'], // Universal Recipient
    'A-': ['A-', 'O-'],
    'O-': ['O-'],
    'B-': ['B-', 'O-'],
    'AB-': ['AB-', 'A-', 'B-', 'O-']
}

export async function POST(request: Request) {
    const { requestId, bloodGroup, hospitalName, city, urgencyLevel } = await request.json()

    if (!requestId || !bloodGroup || !city) {
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
        // 1. Determine Compatible Donor Groups
        // Who can give blood to this patient?
        const groupsToNotify = COMPATIBLE_DONORS[bloodGroup] || [bloodGroup, 'O-'] // Fallback to Exact + Universal

        // 2. Find matching donors
        // Criteria: 
        // - Blood Group is compatible
        // - Location (City) matches the request (Demographic)
        // - Is registered as a donor
        let query = supabase
            .from('profiles')
            .select('id, full_name, distance_km: id') // Placeholder for future geo-calc if needed
            .in('blood_group', groupsToNotify)
            .eq('is_donor', true)

        // Demographic Filtering: City Match (Case Insensitive)
        if (city) {
            query = query.ilike('city', city)
        }

        const { data: donors, error: donorError } = await query

        if (donorError) throw donorError

        if (!donors || donors.length === 0) {
            console.log(`No compatible donors found in ${city} for ${bloodGroup}`)
            return NextResponse.json({ message: 'No matching donors found', count: 0 })
        }

        const donorIds = donors.map(d => d.id)

        // 3. Fetch subscriptions for these donors
        const { data: subscriptions, error: subError } = await supabase
            .from('push_subscriptions')
            .select('subscription, user_id')
            .in('user_id', donorIds)

        if (subError) throw subError

        if (!subscriptions || subscriptions.length === 0) {
            return NextResponse.json({ message: 'Found donors but no push subscriptions', count: 0 })
        }

        // 4. Send Notifications
        webpush.setVapidDetails(
            process.env.VAPID_SUBJECT || 'mailto:admin@vitalapp.com',
            process.env.VAPID_PUBLIC_KEY!,
            process.env.VAPID_PRIVATE_KEY!
        )

        const payload = JSON.stringify({
            title: `URGENT: ${bloodGroup} Blood Needed Nearby!`,
            body: `${city}: ${hospitalName} needs help. You are a match!`,
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
