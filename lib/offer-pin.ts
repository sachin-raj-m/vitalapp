import { supabase } from '@/lib/supabase';

/**
 * Every offer has its own random 4-digit PIN, created by the database
 * (donation_pins). Only the donor who made the offer can read it.
 */
export async function pinForDonation(donationId: string): Promise<string | null> {
    const { data } = await supabase.from('donation_pins').select('pin').eq('donation_id', donationId).maybeSingle();
    return data?.pin ?? null;
}

/** PINs for several of the signed-in donor's offers, keyed by donation id. */
export async function pinsForDonations(donationIds: string[]): Promise<Record<string, string>> {
    if (donationIds.length === 0) return {};
    const { data } = await supabase.from('donation_pins').select('donation_id, pin').in('donation_id', donationIds);
    return Object.fromEntries((data ?? []).map(r => [r.donation_id, r.pin]));
}

/** The PIN of the signed-in donor's pending offer on a request. */
export async function pinForMyOffer(requestId: string, donorId: string): Promise<string | null> {
    const { data } = await supabase
        .from('donations')
        .select('id')
        .eq('request_id', requestId)
        .eq('donor_id', donorId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    return data ? pinForDonation(data.id) : null;
}
