import { MyRequestsContent } from './content';

export const metadata = {
    title: 'My Requests | Vital',
    description: 'Manage your blood donation requests',
};

import { ProtectedRoute } from '@/components/ProtectedRoute';

export default function MyRequestsPage() {
    return (
        <ProtectedRoute>
            <MyRequestsContent />
        </ProtectedRoute>
    );
}
