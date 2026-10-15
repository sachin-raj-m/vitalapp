import { Metadata } from 'next';
import HomePageContent from './content';
import { SITE_OG_IMAGE } from '@/lib/seo';
import { fetchPublicStats } from '@/lib/public-stats';

// Totals are cached for five minutes (PUBLIC_STATS_REVALIDATE), not fetched per view.
export const revalidate = 300;

export const metadata: Metadata = {
    alternates: { canonical: '/' },
    title: { absolute: 'Vital — Blood, when it’s needed' },
    description: 'Vital alerts nearby, eligible blood donors the moment a request goes up. Free, voluntary, and private.',
    openGraph: {
        type: 'website',
        siteName: 'Vital',
        locale: 'en_IN',
        url: '/',
        images: [SITE_OG_IMAGE],
        title: 'Vital — Blood, when it’s needed',
        description: 'Vital alerts nearby, eligible blood donors the moment a request goes up. Free, voluntary, and private.',
    },
};

export default async function HomePage() {
    return <HomePageContent initialStats={await fetchPublicStats()} />;
}
