import { Metadata } from 'next';
import RequestsPageContent from './content';

export const metadata: Metadata = {
    title: 'Blood Requests - Vital Blood Donation',
    description: 'View active blood donation requests and help those in need.',
};

export default function RequestsPage() {
    return <RequestsPageContent />;
}
