import { Metadata } from 'next';
import DashboardPageContent from './content';

export const metadata: Metadata = {
    title: 'Dashboard - Vital Blood Donation',
    description: 'Manage your blood requests and find donation opportunities.',
};

export default function DashboardPage() {
    return <DashboardPageContent />;
}
