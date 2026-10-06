import { Metadata } from 'next';
import RequestsPageContent from './content';

export const metadata: Metadata = {
    alternates: { canonical: '/requests' },
    title: 'Open requests',
    description: 'View active blood donation requests and help those in need.',
};

export default function RequestsPage() {
    return <RequestsPageContent />;
}
