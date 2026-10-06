import { Metadata } from 'next';
import CreateRequestPageContent from './content';

export const metadata: Metadata = {
    title: 'Request blood',
    description: 'Create a new blood donation request for urgent needs.',
};

// Open to everyone: people without an account verify with an email code
// inside the form instead of registering first.
export default function CreateRequestPage() {
    return <CreateRequestPageContent />;
}
