import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabase = createClient(
            SUPABASE_URL!,
            SUPABASE_SERVICE_ROLE_KEY!
        )

        // Get the webhook payload
        const payload = await req.json()
        const { record } = payload

        // Check if it's an INSERT operation on blood_requests
        if (!record || !record.blood_group) {
            return new Response(
                JSON.stringify({ message: 'Invalid payload' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            )
        }

        console.log(`New blood request: ${record.blood_group} at ${record.hospital_name}`)

        // Find compatible donors
        // For simplicity: Exact blood group match + is_donor + is_available
        const { data: donors, error: donorError } = await supabase
            .from('profiles')
            .select('email, full_name, phone')
            .eq('blood_group', record.blood_group)
            .eq('is_donor', true)
            .eq('is_available', true)

        if (donorError) throw donorError

        console.log(`Found ${donors?.length} potential donors`)

        if (!donors || donors.length === 0) {
            return new Response(
                JSON.stringify({ message: 'No matching donors found' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            )
        }

        // Send notifications (Email via Resend)
        // In a real app, you would iterate and send individual emails or batch them
        const results = []

        if (RESEND_API_KEY) {
            for (const donor of donors) {
                try {
                    const res = await fetch('https://api.resend.com/emails', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${RESEND_API_KEY}`
                        },
                        body: JSON.stringify({
                            from: 'Vital App <noreply@vitalapp.com>',
                            to: donor.email,
                            subject: `Urgent: ${record.blood_group} Blood Needed`,
                            html: `
                            <h1>Urgent Blood Request</h1>
                            <p>Hi ${donor.full_name},</p>
                            <p>There is an urgent need for <strong>${record.blood_group}</strong> blood at <strong>${record.hospital_name}</strong>.</p>
                            <p><strong>Urgency:</strong> ${record.urgency_level}</p>
                            <p><strong>Location:</strong> ${record.hospital_address}</p>
                            <p>Please check the Vital App for more details and to respond.</p>
                            <br/>
                            <a href="${SUPABASE_URL}/requests">View Request</a>
                        `
                        })
                    })
                    const data = await res.json()
                    results.push({ email: donor.email, status: res.status, data })
                } catch (e) {
                    console.error(`Failed to send email to ${donor.email}`, e)
                    results.push({ email: donor.email, error: e.message })
                }
            }
        } else {
            console.log("RESEND_API_KEY not set. Skipping email sending.")
            results.push({ message: "Simulated sending", count: donors.length })
        }

        return new Response(
            JSON.stringify({ message: 'Notifications processed', results }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )

    } catch (error) {
        console.error(error)
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
    }
})
