import { ImageResponse } from 'next/og';
import { ClosedRequestCard, DATA_IMAGE_HEADERS, POSTER_SIZE, RequestPoster, fetchOpenRequest, loadOgFonts } from '@/lib/og';

export const runtime = 'edge';

/**
 * GET /requests/:id/poster -> 1080x1350 PNG for WhatsApp Status / Instagram.
 * Add ?download=1 to get it as an attachment. Closed, private or unknown requests get a
 * generic "closed" poster with a 404 status. Never includes contact details.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const [request, fonts] = await Promise.all([fetchOpenRequest(id), loadOgFonts()]);

    const download = new URL(req.url).searchParams.has('download');
    const fileName = request ? `vital-${request.blood_group.replace('+', 'pos').replace('-', 'neg')}-blood-request.png` : 'vital-request-closed.png';

    return new ImageResponse(
        request ? <RequestPoster r={request} f={fonts} /> : <ClosedRequestCard f={fonts} tall />,
        {
            ...POSTER_SIZE,
            fonts: fonts.fonts,
            status: request ? 200 : 404,
            headers: {
                ...DATA_IMAGE_HEADERS,
                'content-disposition': `${download ? 'attachment' : 'inline'}; filename="${fileName}"`,
            },
        }
    );
}
