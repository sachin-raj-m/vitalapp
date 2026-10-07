import { Metadata } from 'next';
import MilestonesPageContent from './content';

export const metadata: Metadata = {
    title: 'Milestones',
    description: 'See the blood donation milestones you have reached on Vital.',
};

export default function MilestonesPage() {
    return <MilestonesPageContent />;
}
