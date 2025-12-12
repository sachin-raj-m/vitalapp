import { Metadata } from 'next';
import HomePageContent from './content';

export const metadata: Metadata = {
    title: 'Vital Blood Donation - Save Lives',
    description: 'Connect with blood donors in real-time and help save lives. Join our community of heroes making a difference.',
};

export default function HomePage() {
    return <HomePageContent />;
}
