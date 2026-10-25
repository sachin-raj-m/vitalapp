import { NextResponse } from 'next/server'
import webpush from 'web-push'
import { getBloodRequestEmailHtml } from '@/lib/email-templates'
import { sendEmail } from '@/lib/email'
import { getCompatibleDonors, formatBloodGroup } from '@/lib/blood-compatibility'
import { getVerifiedUser, serviceClient } from '@/lib/supabase-route'
import { rateLimit, tooManyRequests } from '@/lib/rate-limit'
import { SITE_URL } from '@/lib/site'
import type { BloodGroup } from '@/types'
import { TEMPLATES, sendTemplate, waNumber, whatsappEnabled } from '@/lib/whatsapp'
import { formatNeededBy, placeLabel } from '@/lib/share'
import { MATCH_RADIUS_KM, hasUsableLocation } from '@/lib/geo'
import { PIN_CODE } from '@/lib/location'
import { pinRegion } from '@/lib/pin-geocode'
import { matchDistrict, matchState, resolveRegion } from '@/lib/india-regions'

// A donor gets at most this many WhatsApp alerts in 24 hours.
const WHATSAPP_ALERTS_PER_DAY = 3

// Sends can take a while, and the PIN code's district is looked up first (up to 4 s).
export const maxDuration = 60

/**
 * Exact, case-insensitive match pattern for ilike: escapes LIKE wildcards
 * (% _ and PostgREST's * alias) so a city like "%" can't match every city.
 */
function exactIlikePattern(value: string) {
    return value.replace(/[\\%_*]/g, ch => `\\${ch}`)
}

/**
 * The request's district and state, as listed in lib/india-regions: from its
 * PIN code (India Post's directory, one short call), else from the typed city
 * when that is a district's name or a known alias ("Trivandrum"), within the
 * PIN's state if we got that far. Empty strings when it can't be told.
 */
async function requestRegion(zipcode: string | null, city: string | null): Promise<{ state: string; district: string }> {
    const zip = (zipcode ?? '').replace(/\s/g, '')
    let state = ''
    if (PIN_CODE.test(zip)) {
        const post = await pinRegion(zip, 4000)
        if (post) {
            const r = resolveRegion(post.state, post.district)
            if (r.district) return r
            state = r.state
        }
    }
    if (state) return { state, district: matchDistrict(state, city) }
    return resolveRegion(null, city)
}

type Donor = { id: string; full_name: string | null; email: string | null; phone: string | null; whatsapp_alerts: boolean | null }

/**
 * Alerts compatible, available donors about a new request. The caller only
 * sends a requestId; everything else is loaded from the database, and the
 * request must belong to the caller and not have been broadcast before.
 *
 * Who hears about it, and how (WhatsApp costs money per message):
 *  - Donors with a usable location within MATCH_RADIUS_KM of the request's
 *    location ("radius" donors): WhatsApp (opted in, daily cap), else email,
 *    plus web push.
 *  - Donors with NO usable location in the request's area ("area fallback",
 *    reported as matchedCityFallback for compatibility): email only. Never
 *    WhatsApp or push: we cannot tell whether they are within the radius, but
 *    email is cheap and keeps them from being cut off until they set a
 *    location. Donors who do have a location outside the radius are not
 *    alerted at all, even in the same district.
 *  - Requests without valid coordinates: no radius audience; the area
 *    fallback covers every compatible donor in the area, by email and web
 *    push (both free), never WhatsApp.
 *
 * "The request's area" is its district, worked out here from the request's
 * PIN code (or its typed city) and saved on blood_requests.district/state.
 * Donors match when their profile district is that district (and their state,
 * if set, is its state). Donors whose profile city equals the request's typed
 * city also match, as before, so older profiles with a hand-typed district
 * aren't dropped.
 */
export async function POST(request: Request) {
    const { supabase, user } = await getVerifiedUser(request)
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // A broadcast per request is enforced below; this caps requests per user.
    if (!(await rateLimit(`notify-donors:${user.id}`, 60 * 60, 5))) {
        return tooManyRequests(60 * 60)
    }

    const { requestId } = await request.json().catch(() => ({}))
    if (typeof requestId !== 'string') {
        return NextResponse.json({ error: 'requestId is required' }, { status: 400 })
    }

    // Read as the caller so RLS confirms ownership.
    const { data: bloodRequest } = await supabase
        .from('blood_requests')
        .select('id, user_id, blood_group, hospital_name, city, zipcode, location, urgency_level, status, created_at, date_needed')
        .eq('id', requestId)
        .maybeSingle()

    if (!bloodRequest || bloodRequest.user_id !== user.id) {
        return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }
    // Never alert for a closed or already-expired request (needed-by date
    // before today in India).
    const todayIndia = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10)
    if (bloodRequest.status !== 'active' || (bloodRequest.date_needed && bloodRequest.date_needed < todayIndia)) {
        return NextResponse.json({ error: 'Request is not open' }, { status: 409 })
    }
    // One broadcast per request: only right after it is created.
    if (Date.now() - new Date(bloodRequest.created_at).getTime() > 10 * 60 * 1000) {
        return NextResponse.json({ error: 'Alerts are only sent when a request is first posted' }, { status: 409 })
    }

    const admin = serviceClient()
    const groups = getCompatibleDonors(bloodRequest.blood_group as BloodGroup)
    const group = formatBloodGroup(bloodRequest.blood_group)
    const point = hasUsableLocation(bloodRequest.location) ? bloodRequest.location : null
    const city = bloodRequest.city?.trim()

    try {
        // 1. Within the radius of the request (needs coordinates on both sides).
        let radiusDonors: Donor[] = []
        if (point) {
            const { data, error } = await admin.rpc('donors_within_radius', {
                p_latitude: point.latitude,
                p_longitude: point.longitude,
                p_recipient_group: bloodRequest.blood_group,
                p_exclude_user: user.id,
                p_radius_km: MATCH_RADIUS_KM,
            })
            if (error) throw error
            radiusDonors = (data ?? []) as Donor[]
        }

        // 2. Area fallback, email only: compatible donors in the same district
        // with no usable location (or everyone in the district when the request
        // itself has no coordinates). Donors with a location are judged by
        // distance alone, so they are dropped here.
        const region = await requestRegion(bloodRequest.zipcode, city || null)
        if (region.district) {
            // Best effort: lets the admin pages count requests by district.
            await admin.from('blood_requests').update({ district: region.district, state: region.state || null })
                .eq('id', bloodRequest.id).then(() => {}, () => {})
        }
        const sameArea = (column: 'district' | 'city', value: string) => admin
            .from('profiles')
            .select('id, full_name, email, phone, whatsapp_alerts, location, state')
            .in('blood_group', groups)
            .eq('is_donor', true)
            .eq('is_available', true)
            .neq('id', user.id)
            .ilike(column, exactIlikePattern(value))
        const [byDistrict, byCity] = await Promise.all([
            region.district ? sameArea('district', region.district) : null,
            city ? sameArea('city', city) : null,
        ])
        if (byDistrict?.error) throw byDistrict.error
        if (byCity?.error) throw byCity.error
        type AreaDonor = NonNullable<NonNullable<typeof byCity>['data']>[number]
        const areaMatches = new Map<string, AreaDonor>()
        // The same district name in another (recognised) state, e.g. Aurangabad,
        // is another place; an unset or unrecognised state doesn't rule a donor out.
        for (const d of byDistrict?.data ?? []) {
            const donorState = matchState(d.state)
            if (!region.state || !donorState || donorState === region.state) areaMatches.set(d.id, d)
        }
        for (const d of byCity?.data ?? []) areaMatches.set(d.id, d)
        const inRadius = new Set(radiusDonors.map(d => d.id))
        const cityDonors: Donor[] = [...areaMatches.values()]
            .filter(d => !inRadius.has(d.id) && (!point || !hasUsableLocation(d.location)))
            .map(d => ({ id: d.id, full_name: d.full_name, email: d.email, phone: d.phone, whatsapp_alerts: d.whatsapp_alerts }))

        const counts = {
            radiusKm: MATCH_RADIUS_KM,
            requestHasLocation: Boolean(point),
            requestDistrict: region.district || null,
            matchedWithinRadius: radiusDonors.length,
            matchedCityFallback: cityDonors.length,
        }
        if (!radiusDonors.length && !cityDonors.length) {
            return NextResponse.json({ ...counts, matchedDonors: 0, whatsappSent: 0, emailsSent: 0, emailsSentCityFallback: 0, notificationsSent: 0 })
        }

        const requestLink = `${SITE_URL}/requests/${bloodRequest.id}`

        // WhatsApp only for radius donors who opted in (with a daily cap).
        const viaWhatsApp = new Set<string>()
        let whatsappSent = 0
        if (whatsappEnabled()) {
            const candidates = radiusDonors.filter(d => d.whatsapp_alerts && waNumber(d.phone))
            const { data: recent } = candidates.length
                ? await admin.from('whatsapp_messages').select('user_id')
                    .eq('kind', 'alert').neq('status', 'failed')
                    .in('user_id', candidates.map(d => d.id))
                    .gt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
                : { data: [] as { user_id: string | null }[] }
            const sentToday = new Map<string, number>()
            for (const r of recent ?? []) if (r.user_id) sentToday.set(r.user_id, (sentToday.get(r.user_id) ?? 0) + 1)

            const place = placeLabel(bloodRequest.hospital_name, bloodRequest.city) || 'a hospital near you'
            const neededBy = formatNeededBy(bloodRequest.date_needed)
            // Only a send WhatsApp accepted counts; a failed one (e.g. a template
            // still in review) falls through to email below.
            await Promise.allSettled(candidates.filter(d => (sentToday.get(d.id) ?? 0) < WHATSAPP_ALERTS_PER_DAY).map(donor => {
                return sendTemplate(waNumber(donor.phone)!, TEMPLATES.donorAlert, {
                    body: [group, place, neededBy ? `Needed by ${neededBy}.` : 'Needed as soon as possible.'],
                    quickReplies: [`offer:${bloodRequest.id}`, `decline:${bloodRequest.id}`],
                    urlSuffix: { index: 2, value: bloodRequest.id },
                }, { kind: 'alert', userId: donor.id, requestId: bloodRequest.id }).then(id => { if (id) { whatsappSent++; viaWhatsApp.add(donor.id) } })
            }))
        }

        // Email for radius donors not reached on WhatsApp, and for the area fallback.
        let emailsSent = 0
        let emailsSentCityFallback = 0
        const fallbackIds = new Set(cityDonors.map(d => d.id))
        if (process.env.SMTP_USER) {
            await Promise.allSettled([...radiusDonors, ...cityDonors].filter(d => d.email && !viaWhatsApp.has(d.id)).map(donor =>
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
                }).then(() => {
                    emailsSent++
                    if (fallbackIds.has(donor.id)) emailsSentCityFallback++
                })
            ))
        }

        // Web push: radius donors; for a request without coordinates, the
        // area fallback instead (there is no radius audience then). Donors
        // without a location never get push for a request that has one.
        let pushSent = 0
        const pushAudience = point ? radiusDonors : cityDonors
        const { data: subscriptions, error: subError } = pushAudience.length
            ? await admin
                .from('push_subscriptions')
                .select('id, subscription')
                .in('user_id', pushAudience.map(d => d.id))
            : { data: [] as { id: string; subscription: unknown }[], error: null }
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

        return NextResponse.json({
            ...counts,
            matchedDonors: radiusDonors.length + cityDonors.length,
            whatsappSent,
            emailsSent,
            emailsSentCityFallback,
            notificationsSent: pushSent,
        })
    } catch (error: any) {
        console.error('Error in notify/donors:', error)
        return NextResponse.json({ error: 'Could not notify donors' }, { status: 500 })
    }
}
