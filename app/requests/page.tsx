import RequestsPageContent from './content';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
    path: '/requests',
    title: 'Open requests',
    description: 'Open blood requests near you. Anyone able to donate can respond; Vital only connects people.',
});

export default function RequestsPage() {
    return <RequestsPageContent />;
}
