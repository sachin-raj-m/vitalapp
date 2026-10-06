import { Metadata } from 'next';
import HomePageContent from './content';

export const metadata: Metadata = {
    alternates: { canonical: '/' },
    title: { absolute: 'Vital — Blood, when it’s needed' },
    description: 'Vital alerts nearby, eligible blood donors the moment a request goes up. Free, voluntary, and private.',
};

export default function HomePage() {
    return <HomePageContent />;
}
