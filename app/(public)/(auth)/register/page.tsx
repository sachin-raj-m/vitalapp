import RegisterPageContent from './content';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
    path: '/register',
    title: 'Become a donor',
    description: 'Register as a voluntary blood donor on Vital. Free, and your details stay private.',
});

export default function RegisterPage() {
    return (
        <div className="container mx-auto px-4 py-8">
            <RegisterPageContent />
        </div>
    );
}
