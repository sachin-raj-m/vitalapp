import { ImageResponse } from 'next/og';
import { createClient } from '@supabase/supabase-js';
import { parseDonorSlug } from '@/lib/donor-slug';
import { DATA_IMAGE_HEADERS, GroupMark, OG_COLORS as C, OG_SIZE, SITE_HOST, loadOgFonts } from '@/lib/og';

export const runtime = 'edge';
export const alt = 'Donor card on Vital';
export const size = OG_SIZE;
export const contentType = 'image/png';

type PublicDonor = { first_name: string | null; blood_group: string | null; donor_number: number | null };

async function fetchPublicDonor(slug: string): Promise<PublicDonor | null> {
    const parsed = parseDonorSlug(slug);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!parsed || !url || !key) return null;
    try {
        const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
        const { data } = await supabase
            .rpc('public_donor_card', parsed.isUuid ? { p_id: parsed.lookupId } : { p_donor_number: parseInt(parsed.lookupId) })
            .maybeSingle<{ display_name: string | null; blood_group: string | null; donor_number: number; is_public_profile: boolean }>();
        // Never put a private profile's details in a share preview.
        if (!data?.is_public_profile) return null;
        return { first_name: data.display_name?.split(' ')[0] ?? null, blood_group: data.blood_group, donor_number: data.donor_number };
    } catch {
        return null;
    }
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const [donor, f] = await Promise.all([fetchPublicDonor(decodeURIComponent(id)), loadOgFonts()]);

    return new ImageResponse(
        (
            <div style={{ display: 'flex', width: '100%', height: '100%', background: C.white, color: C.ink, fontFamily: f.sans, padding: 48 }}>
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, borderRadius: 36, background: C.ink, color: C.white, padding: '48px 56px', position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', fontFamily: f.serif, fontSize: 56, fontWeight: 600, lineHeight: 1 }}>vital</div>
                        <div style={{ display: 'flex', fontSize: 22, fontWeight: 800, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)' }}>
                            {donor?.donor_number ? `Donor #${donor.donor_number}` : 'Blood donor card'}
                        </div>
                    </div>
                    <div style={{ display: 'flex', flex: 1, alignItems: 'flex-end', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 620 }}>
                            <div style={{ display: 'flex', fontFamily: f.serif, fontSize: 88, fontWeight: 600, lineHeight: 1.02, letterSpacing: -1.5 }}>
                                {donor?.first_name ? `${donor.first_name} is a blood donor.` : 'Be someone’s blood donor.'}
                            </div>
                            <div style={{ display: 'flex', marginTop: 20, fontSize: 28, color: 'rgba(255,255,255,0.72)' }}>
                                {`Free and voluntary. Join at ${SITE_HOST}`}
                            </div>
                        </div>
                        {donor?.blood_group && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 300, height: 300, borderRadius: 150, background: C.red }}>
                                <GroupMark group={donor.blood_group} size={donor.blood_group.length > 2 ? 104 : 136} color={C.white} />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        ),
        { ...size, fonts: f.fonts, headers: DATA_IMAGE_HEADERS }
    );
}
