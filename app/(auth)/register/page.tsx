import { Metadata } from 'next';
import RegisterPageContent from './content';

export const metadata: Metadata = {
    title: 'Register - Vital Blood Donation',
    description: 'Create a new account to become a blood donor or request blood.',
};

export default function RegisterPage() {
    return <RegisterPageContent />;
}
