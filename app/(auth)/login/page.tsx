import { Metadata } from 'next';
import LoginPageContent from './content';

export const metadata: Metadata = {
    title: 'Login - Vital Blood Donation',
    description: 'Sign in to your Vital Blood Donation account to manage requests and donations.',
};

export default function LoginPage() {
    return (
        <div className="container mx-auto px-4 py-8">
            <LoginPageContent />
        </div>
    );
}
