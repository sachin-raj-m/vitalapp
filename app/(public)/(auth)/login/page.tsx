import LoginPageContent from './content';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
    path: '/login',
    title: 'Sign in',
    description: 'Sign in to Vital to manage your blood requests and donor card.',
});

export default function LoginPage() {
    return (
        <div className="container mx-auto px-4 py-8">
            <LoginPageContent />
        </div>
    );
}
