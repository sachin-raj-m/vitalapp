import { ImageResponse } from 'next/og';
import { createClient } from '@supabase/supabase-js';
import { OG_COLORS as C, OG_SIZE, formatGroup, loadSerif, ogFonts } from '@/lib/og';

export const runtime = 'edge';
export const alt = 'Blood request on Vital';
export const size = OG_SIZE;
export const contentType = 'image/png';

const URGENCY = { High: 'Urgent', Medium: 'Needed soon', Low: 'Planned' } as Record<string, string>;

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

    const [{ data: request }, serif] = await Promise.all([
        supabase.from('blood_requests').select('blood_group, units_needed, hospital_name, city, urgency_level').eq('id', id).maybeSingle(),
        loadSerif(),
    ]);

    const serifFamily = serif ? 'Instrument Serif' : 'serif';

    if (!request) {
        return new ImageResponse(
            (
                <div style={{ display: 'flex', width: '100%', height: '100%', background: C.paper, alignItems: 'center', justifyContent: 'center', fontFamily: serifFamily, fontSize: 96, color: C.ink }}>
                    vital
                </div>
            ),
            { ...size, fonts: ogFonts(serif) }
        );
    }

    const urgent = request.urgency_level === 'High';
    const units = `${request.units_needed} unit${request.units_needed > 1 ? 's' : ''}`;

    return new ImageResponse(
        (
            <div style={{ display: 'flex', width: '100%', height: '100%', background: C.paper, color: C.ink }}>
                <div
                    style={{
                        display: 'flex',
                        width: 420,
                        height: '100%',
                        background: urgent ? C.red : C.ink,
                        color: '#fff',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: serifFamily,
                        fontSize: 200,
                        letterSpacing: -6,
                    }}
                >
                    {formatGroup(request.blood_group)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '64px 64px 56px' }}>
                    <div style={{ display: 'flex', fontSize: 22, letterSpacing: 3, textTransform: 'uppercase', color: urgent ? C.red : C.muted }}>
                        {URGENCY[request.urgency_level] ?? 'Blood needed'}
                    </div>
                    <div style={{ display: 'flex', marginTop: 28, fontFamily: serifFamily, fontSize: 76, lineHeight: 1.02, letterSpacing: -1.5 }}>
                        {`${units} needed at ${request.hospital_name}`}
                    </div>
                    {request.city && (
                        <div style={{ display: 'flex', marginTop: 20, fontSize: 30, color: C.muted }}>{request.city}</div>
                    )}
                    <div style={{ display: 'flex', marginTop: 'auto', alignItems: 'center', justifyContent: 'space-between', borderTop: `2px solid ${C.line}`, paddingTop: 28 }}>
                        <div style={{ display: 'flex', fontSize: 26, color: C.ink }}>Can you donate? Tap to respond.</div>
                        <div style={{ display: 'flex', fontFamily: serifFamily, fontSize: 44 }}>vital</div>
                    </div>
                </div>
            </div>
        ),
        { ...size, fonts: ogFonts(serif) }
    );
}
