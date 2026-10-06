import { ImageResponse } from 'next/og';
import { OG_COLORS as C, OG_SIZE, loadSerif, ogFonts } from '@/lib/og';

export const runtime = 'edge';
export const alt = 'Vital: someone near you will need blood today.';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default async function Image() {
    const serif = await loadSerif();
    const family = serif ? 'Instrument Serif' : 'serif';

    return new ImageResponse(
        (
            <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: C.paper, color: C.ink, padding: '64px 72px' }}>
                <div style={{ display: 'flex', fontFamily: family, fontSize: 52 }}>vital</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: 'auto', fontFamily: family, fontSize: 112, lineHeight: 0.98, letterSpacing: -3 }}>
                    Someone near you will need blood&nbsp;<span style={{ color: C.red, fontStyle: 'italic' }}>today.</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 40, paddingTop: 24, borderTop: `2px solid ${C.line}`, fontSize: 26, color: C.muted }}>
                    <span>Free, voluntary blood donor network</span>
                    <span>vitalapp.in</span>
                </div>
            </div>
        ),
        { ...size, fonts: ogFonts(serif) }
    );
}
