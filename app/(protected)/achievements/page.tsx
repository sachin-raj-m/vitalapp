import { Metadata } from 'next';
import AchievementsPageContent from './content';

export const metadata: Metadata = {
    title: 'Achievements - Vital Blood Donation',
    description: 'View your earned badges and rewards for blood donation.',
};

export default function AchievementsPage() {
    return <AchievementsPageContent />;
}
