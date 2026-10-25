import { NextResponse } from 'next/server'
import { getVerifiedUser } from '@/lib/supabase-route'
import { rateLimit, tooManyRequests } from '@/lib/rate-limit'
import { ALERT_REQUEST_COLUMNS, alertBlockReason, alertDonors, type AlertableRequest } from '@/lib/donor-alerts'

// Sends can take a while, and the PIN code's district is looked up first (up to 4 s).
export const maxDuration = 60

/**
 * Alerts compatible, available donors about a new request. The caller only
 * sends a requestId; everything else is loaded from the database, and the
 * request must belong to the caller and not have been broadcast before.
 * Who is alerted, and how: lib/donor-alerts.ts (shared with requests posted
 * over WhatsApp).
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
        .select(ALERT_REQUEST_COLUMNS)
        .eq('id', requestId)
        .maybeSingle<AlertableRequest>()

    if (!bloodRequest || bloodRequest.user_id !== user.id) {
        return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }
    // Never alert for a closed or already-expired request (needed-by date
    // before today in India). One broadcast per request: only right after it
    // is created.
    const blocked = alertBlockReason(bloodRequest)
    if (blocked === 'not_open') {
        return NextResponse.json({ error: 'Request is not open' }, { status: 409 })
    }
    if (blocked === 'too_late') {
        return NextResponse.json({ error: 'Alerts are only sent when a request is first posted' }, { status: 409 })
    }

    try {
        return NextResponse.json(await alertDonors(bloodRequest))
    } catch (error) {
        console.error('Error in notify/donors:', error)
        return NextResponse.json({ error: 'Could not notify donors' }, { status: 500 })
    }
}
