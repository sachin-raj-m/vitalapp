import { ImageResponse } from 'next/og';
import { supabase } from '@/lib/supabase';
import { parseDonorSlug } from '@/lib/donor-slug';
import { OG_COLORS as C, OG_SIZE, formatGroup, loadSerif, ogFonts } from '@/lib/og';

export const runtime = 'edge';
export const revalidate = 60;
export const alt = 'Donor card on Vital';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const parsed = parseDonorSlug(decodeURIComponent(id));

    let profile: { full_name: string | null; blood_group: string | null; donor_number: number | null } | null = null;

    if (parsed) {
        const query = supabase.from('public_donors').select('display_name, blood_group, donor_number, is_public_profile');
        const { data } = await (parsed.isUuid
            ? query.eq('id', parsed.lookupId)
            : query.eq('donor_number', parseInt(parsed.lookupId))
        ).maybeSingle();
        // Never put a private profile's details in a share preview.
        if (data?.is_public_profile) profile = { full_name: data.display_name, blood_group: data.blood_group, donor_number: data.donor_number };
    }

    const serif = await loadSerif();
    const serifFamily = serif ? 'Instrument Serif' : 'serif';
    const firstName = profile?.full_name?.split(' ')[0];

    return new ImageResponse(
        (
            <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: C.ink, color: '#fff', padding: '64px 72px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', fontFamily: serifFamily, fontSize: 48 }}>vital</div>
                    <div style={{ display: 'flex', fontSize: 20, letterSpacing: 3, textTransform: 'uppercase', color: C.muted }}>
                        {profile?.donor_number ? `Donor #${profile.donor_number}` : 'Donor card'}
                    </div>
                </div>
                <div style={{ display: 'flex', flex: 1, alignItems: 'flex-end', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 640 }}>
                        <div style={{ display: 'flex', fontFamily: serifFamily, fontSize: 84, lineHeight: 1, letterSpacing: -2 }}>
                            {firstName ? `${firstName} is a blood donor.` : 'Be someone’s blood donor.'}
                        </div>
                        <div style={{ display: 'flex', marginTop: 24, fontSize: 28, color: C.muted }}>
                            Free, voluntary, and nearby. Join the network.
                        </div>
                    </div>
                    {profile?.blood_group && (
                        <div style={{ display: 'flex', fontFamily: serifFamily, fontSize: 260, lineHeight: 0.8, color: '#DF5B53', letterSpacing: -8 }}>
                            {formatGroup(profile.blood_group)}
                        </div>
                    )}
                </div>
            </div>
        ),
        { ...size, fonts: ogFonts(serif) }
    );
}
