import { Metadata } from 'next';
import HomePageContent from './content';
import { SITE_OG_IMAGE } from '@/lib/seo';

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

export default function HomePage() {
    return <HomePageContent />;
}
