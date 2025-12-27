import { Metadata } from 'next';
import CreateRequestPageContent from './content';

export const metadata: Metadata = {
    title: 'Create Request - Vital Blood Donation',
    description: 'Create a new blood donation request for urgent needs.',
};

import { ProtectedRoute } from '@/components/ProtectedRoute';

export default function CreateRequestPage() {
    return (
        <ProtectedRoute>
            <CreateRequestPageContent />
        </ProtectedRoute>
    );
}
