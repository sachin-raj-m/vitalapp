import { Metadata } from 'next';
import DonationsPageContent from './content';

export const metadata: Metadata = {
    title: 'My Donations',
    description: 'Track your blood donation history and impact.',
};

export default function DonationsPage() {
    return <DonationsPageContent />;
}
