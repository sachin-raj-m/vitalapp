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
            .select('id, full_name, email, distance_km: id') // Placeholder for future geo-calc if needed
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

        // 3. Send Emails (Resend API)
        let emailsSent = 0
        const RESEND_API_KEY = process.env.RESEND_API_KEY

        if (RESEND_API_KEY) {
            const emailPromises = donors.map(donor => {
                if (!donor.email) return Promise.resolve()

                return fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${RESEND_API_KEY}`
                    },
                    body: JSON.stringify({
                        from: 'Vital App <onboarding@resend.dev>', // Use verified domain or test domain
                        to: donor.email,
                        subject: `URGENT: ${bloodGroup} Blood Needed in ${city}`,
                        html: `
                            <div style="font-family: sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
                                <h1 style="color: #e11d48;">Urgent Blood Request</h1>
                                <p>Hi ${donor.full_name},</p>
                                <p>There is an urgent need for <strong>${bloodGroup}</strong> blood nearby.</p>
                                
                                <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                                    <p><strong>🏥 Hospital:</strong> ${hospitalName}</p>
                                    <p><strong>📍 City:</strong> ${city}</p>
                                    <p><strong>🚨 Urgency:</strong> ${urgencyLevel}</p>
                                </div>

                                <p>You are receiving this because you are a registered donor and a medical match.</p>
                                
                                <a href="${process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vitalapp.vercel.app'}/requests" 
                                   style="display: inline-block; background: #e11d48; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                                   View Request & Respond
                                </a>
                            </div>
                        `
                    })
                })
                    .then(res => {
                        if (res.ok) emailsSent++
                        else console.error('Email failed', res.status)
                    })
                    .catch(e => console.error('Email error', e))
            })
            // Fire emails in background (don't await strictly if performance is key, but await for MVP debugging)
            await Promise.allSettled(emailPromises)
        }

        // 4. Fetch subscriptions for Push (Parallel track)
        const { data: subscriptions, error: subError } = await supabase
            .from('push_subscriptions')
            .select('subscription, user_id')
            .in('user_id', donorIds)

        if (subError) throw subError

        let pushSent = 0
        if (subscriptions && subscriptions.length > 0) {
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
                    .then(() => pushSent++)
                    .catch(err => {
                        if (err.statusCode === 410 || err.statusCode === 404) {
                            return supabase.from('push_subscriptions').delete().eq('user_id', sub.user_id)
                        }
                        console.error('Push error:', err)
                    })
            )
            await Promise.allSettled(promises)
        }

        return NextResponse.json({
            success: true,
            matchedDonors: donorIds.length,
            notificationsSent: pushSent,
            emailsSent: emailsSent
        })

    } catch (error: any) {
        console.error('Error in notify/donors:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
