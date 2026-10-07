import { ImageResponse } from 'next/og';
import { OG_COLORS as C, OG_SIZE, SITE_HOST, loadOgFonts } from '@/lib/og';

export const runtime = 'edge';
export const alt = 'Vital: someone near you will need blood today.';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default async function Image() {
    const { fonts, serif, sans } = await loadOgFonts();

    return new ImageResponse(
        (
            <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: C.paper, color: C.ink, fontFamily: sans, padding: '64px 72px' }}>
                <div style={{ display: 'flex', fontFamily: serif, fontSize: 56, letterSpacing: -0.5 }}>vital</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: 'auto', fontFamily: serif, fontSize: 120, lineHeight: 1, letterSpacing: -2 }}>
                    Someone near you will need blood&nbsp;<span style={{ color: C.red, fontStyle: 'italic' }}>today.</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 40, paddingTop: 24, borderTop: `2px solid ${C.line}`, fontSize: 26, color: C.muted }}>
                    <span>Free, voluntary blood donor network</span>
                    <span>{SITE_HOST}</span>
                </div>
            </div>
        ),
        { ...size, fonts }
    );
}
