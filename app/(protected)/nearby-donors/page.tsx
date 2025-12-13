import { Metadata } from 'next';
import NearbyDonorsPageContent from './content';

export const metadata: Metadata = {
    title: 'Nearby Donors | Vital',
    description: 'Find blood donors near your location',
};

export default function NearbyDonorsPage() {
    return <NearbyDonorsPageContent />;
}
