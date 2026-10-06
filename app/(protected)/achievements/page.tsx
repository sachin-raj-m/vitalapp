import { Metadata } from 'next';
import AchievementsPageContent from './content';

export const metadata: Metadata = {
    title: 'Milestones',
    description: 'View your earned badges and rewards for blood donation.',
};

export default function AchievementsPage() {
    return <AchievementsPageContent />;
}
