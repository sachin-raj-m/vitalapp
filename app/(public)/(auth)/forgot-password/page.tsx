import { Metadata } from 'next';
import ForgotPasswordContent from './content';

export const metadata: Metadata = {
    title: 'Forgot Password',
    description: 'Reset your password for Vital Blood Donation App.',
};

export default function ForgotPasswordPage() {
    return <ForgotPasswordContent />;
}
