import { NextResponse } from 'next/server'
import webpush from 'web-push'
import { getBloodRequestEmailHtml } from '@/lib/email-templates'
import { sendEmail } from '@/lib/email'
import { getCompatibleDonors, formatBloodGroup } from '@/lib/blood-compatibility'
import { getVerifiedUser, serviceClient } from '@/lib/supabase-route'
import { SITE_URL } from '@/lib/site'
import type { BloodGroup } from '@/types'

/**
 * Alerts compatible donors in the request's city. The caller only sends a
 * requestId; everything else is loaded from the database, and the request must
 * belong to the caller and not have been broadcast before.
 */
export async function POST(request: Request) {
    const { supabase, user } = await getVerifiedUser(request)
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { requestId } = await request.json().catch(() => ({}))
    if (typeof requestId !== 'string') {
        return NextResponse.json({ error: 'requestId is required' }, { status: 400 })
    }

    // Read as the caller so RLS confirms ownership.
    const { data: bloodRequest } = await supabase
        .from('blood_requests')
        .select('id, user_id, blood_group, hospital_name, city, urgency_level, status, created_at')
        .eq('id', requestId)
        .maybeSingle()

    if (!bloodRequest || bloodRequest.user_id !== user.id) {
        return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }
    if (bloodRequest.status !== 'active') {
        return NextResponse.json({ error: 'Request is not open' }, { status: 409 })
    }
    // One broadcast per request: only right after it is created.
    if (Date.now() - new Date(bloodRequest.created_at).getTime() > 10 * 60 * 1000) {
        return NextResponse.json({ error: 'Alerts are only sent when a request is first posted' }, { status: 409 })
    }

    const admin = serviceClient()
    const groups = getCompatibleDonors(bloodRequest.blood_group as BloodGroup)
    const group = formatBloodGroup(bloodRequest.blood_group)

    try {
        let query = admin
            .from('profiles')
            .select('id, full_name, email')
            .in('blood_group', groups)
            .eq('is_donor', true)
            .eq('is_available', true)
            .neq('id', user.id)
        if (bloodRequest.city) query = query.ilike('city', bloodRequest.city)

        const { data: donors, error: donorError } = await query
        if (donorError) throw donorError
        if (!donors?.length) {
            return NextResponse.json({ matchedDonors: 0, notificationsSent: 0, emailsSent: 0 })
        }

        const requestLink = `${SITE_URL}/requests/${bloodRequest.id}`
        let emailsSent = 0
        if (process.env.SMTP_USER) {
            await Promise.allSettled(donors.filter(d => d.email).map(donor =>
                sendEmail({
                    to: donor.email!,
                    subject: `${group} blood needed${bloodRequest.city ? ` in ${bloodRequest.city}` : ''}`,
                    html: getBloodRequestEmailHtml({
                        donorName: donor.full_name || 'there',
                        bloodGroup: group,
                        hospitalName: bloodRequest.hospital_name,
                        city: bloodRequest.city || '',
                        urgencyLevel: bloodRequest.urgency_level,
                        requestLink,
                    }),
                }).then(() => { emailsSent++ })
            ))
        }

        let pushSent = 0
        const { data: subscriptions, error: subError } = await admin
            .from('push_subscriptions')
            .select('id, subscription')
            .in('user_id', donors.map(d => d.id))
        if (subError) throw subError

        if (subscriptions?.length && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
            webpush.setVapidDetails(
                process.env.VAPID_SUBJECT || 'mailto:sachin@vitalapp.in',
                process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
                process.env.VAPID_PRIVATE_KEY
            )
            const payload = JSON.stringify({
                title: `${group} blood needed nearby`,
                body: `${bloodRequest.hospital_name}${bloodRequest.city ? `, ${bloodRequest.city}` : ''} needs your blood group.`,
                url: `/requests/${bloodRequest.id}`,
            })
            await Promise.allSettled(subscriptions.map(sub =>
                webpush.sendNotification(sub.subscription as any, payload)
                    .then(() => { pushSent++ })
                    .catch(err => {
                        // Expired subscription: remove just this one.
                        if (err.statusCode === 410 || err.statusCode === 404) {
                            return admin.from('push_subscriptions').delete().eq('id', sub.id)
                        }
                        console.error('Push error:', err)
                    })
            ))
        }

        return NextResponse.json({ matchedDonors: donors.length, notificationsSent: pushSent, emailsSent })
    } catch (error: any) {
        console.error('Error in notify/donors:', error)
        return NextResponse.json({ error: 'Could not notify donors' }, { status: 500 })
    }
}
