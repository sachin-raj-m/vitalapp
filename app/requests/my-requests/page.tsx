import { MyRequestsContent } from './content';

export const metadata = {
    title: 'My Requests',
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
