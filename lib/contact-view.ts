import { serviceClient } from '@/lib/supabase-route';
import type { ContactLinkRow } from '@/lib/contact-links';

export type ContactSummary = {
    viewer: 'donor' | 'requester';
    bloodGroup: string;
    hospital: string | null;
    address: string | null;
    city: string | null;
    dateNeeded: string | null;
    requestId: string;
    open: boolean;
};

export type ContactDetails = ContactSummary & {
    name: string;
    phone: string | null;
    pin: string | null; // the donor's own PIN, donor view only
};

/** What a contact link is about, without any contact details. */
export async function contactSummary(link: ContactLinkRow): Promise<ContactSummary | null> {
    const admin = serviceClient();
    const { data: d } = await admin.from('donations').select('id, status, request_id').eq('id', link.donation_id).maybeSingle();
    if (!d) return null;
    const { data: r } = await admin.from('blood_requests')
        .select('id, blood_group, hospital_name, hospital_address, city, date_needed, status')
        .eq('id', d.request_id).maybeSingle();
    if (!r) return null;
    const today = new Date().toISOString().slice(0, 10);
    return {
        viewer: link.viewer,
        bloodGroup: r.blood_group,
        hospital: r.hospital_name,
        address: r.hospital_address,
        city: r.city,
        dateNeeded: r.date_needed,
        requestId: r.id,
        // A donor's link is useful while the request is open; a requester's while the offer is pending.
        open: d.status === 'pending' && (link.viewer === 'requester' || (r.status === 'active' && (!r.date_needed || r.date_needed >= today))),
    };
}

/** The contact details behind a link. Callers must have validated the link. */
export async function contactDetails(link: ContactLinkRow, summary: ContactSummary): Promise<ContactDetails> {
    const admin = serviceClient();
    const { data: d } = await admin.from('donations').select('donor_id, request_id').eq('id', link.donation_id).single();
    if (link.viewer === 'donor') {
        const [{ data: r }, { data: c }, { data: s }] = await Promise.all([
            admin.from('blood_requests').select('contact_name').eq('id', d!.request_id).single(),
            admin.from('request_contacts').select('contact_phone').eq('request_id', d!.request_id).maybeSingle(),
            admin.from('donor_secrets').select('pin').eq('user_id', d!.donor_id).maybeSingle(),
        ]);
        return { ...summary, name: r?.contact_name || 'The contact person', phone: c?.contact_phone ?? null, pin: s?.pin ?? null };
    }
    const { data: p } = await admin.from('profiles').select('full_name, phone').eq('id', d!.donor_id).single();
    const first = (p?.full_name || '').trim().split(/\s+/)[0] || 'The donor';
    return { ...summary, name: first, phone: p?.phone ?? null, pin: null };
}
