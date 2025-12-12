import { Metadata } from 'next';
import ProfilePageContent from './content';

export const metadata: Metadata = {
    title: 'My Profile - Vital Blood Donation',
    description: 'Manage your personal profile and preferences.',
};

export default function ProfilePage() {
    return <ProfilePageContent />;
}
