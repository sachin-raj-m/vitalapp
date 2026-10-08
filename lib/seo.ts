import type { Metadata } from 'next';

/**
 * Metadata for a public page, with matching share-preview tags. A page's
 * openGraph/twitter replaces the root layout's rather than merging with it,
 * so the shared fields are repeated here, including the preview image from
 * app/opengraph-image.tsx (a page-level openGraph drops the inherited one).
 */
export const SITE_OG_IMAGE = { url: '/opengraph-image', width: 1200, height: 630, alt: 'Vital: someone near you will need blood today.' };

export function pageMetadata({ path, title, description }: { path: string; title: string; description: string }): Metadata {
    const shareTitle = `${title} · Vital`;
    return {
        title,
        description,
        alternates: { canonical: path },
        openGraph: { type: 'website', siteName: 'Vital', locale: 'en_IN', url: path, title: shareTitle, description, images: [SITE_OG_IMAGE] },
        twitter: { card: 'summary_large_image', title: shareTitle, description },
    };
}
