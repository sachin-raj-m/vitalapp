import { Metadata } from 'next';
import RegisterPageContent from './content';

export const metadata: Metadata = {
    title: 'Register - Vital Blood Donation',
    description: 'Create a new account to become a blood donor or request blood.',
};

export default function RegisterPage() {
    return (
        <div className="container mx-auto px-4 py-8">
            <RegisterPageContent />
        </div>
    );
}
