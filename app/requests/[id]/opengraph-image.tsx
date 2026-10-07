import { ImageResponse } from 'next/og';
import { ClosedRequestCard, DATA_IMAGE_HEADERS, OG_SIZE, RequestOgCard, fetchOpenRequest, loadOgFonts } from '@/lib/og';

export const runtime = 'edge';
export const alt = 'Blood request on Vital';
export const size = OG_SIZE;
export const contentType = 'image/png';

// Anonymous reads only see open requests (RLS), so a fulfilled, cancelled or unknown
// request renders the generic "closed" card. Short cache so closing a request updates it.
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const [request, fonts] = await Promise.all([fetchOpenRequest(id), loadOgFonts()]);

    return new ImageResponse(
        request ? <RequestOgCard r={request} f={fonts} /> : <ClosedRequestCard f={fonts} />,
        { ...size, fonts: fonts.fonts, headers: DATA_IMAGE_HEADERS }
    );
}
