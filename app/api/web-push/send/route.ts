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

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { subscription, title, body, url } = await request.json()

    if (!subscription || !title || !body) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    try {
        webpush.setVapidDetails(
            process.env.VAPID_SUBJECT || 'mailto:admin@vitalapp.com',
            process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
            process.env.VAPID_PRIVATE_KEY!
        )

        const payload = JSON.stringify({
            title,
            body,
            url,
        })

        await webpush.sendNotification(subscription, payload)

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error sending push notification:', error)
        return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 })
    }
}
