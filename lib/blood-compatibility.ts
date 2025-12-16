import { BloodGroup } from '@/types';

// Standard RBC Compatibility Chart
// Key: Recipient (Patient)
// Value: Compatible Donors
const COMPATIBILITY_CHART: Record<BloodGroup, BloodGroup[]> = {
    'O-': ['O-'],
    'O+': ['O-', 'O+'],
    'A-': ['O-', 'A-'],
    'A+': ['O-', 'O+', 'A-', 'A+'],
    'B-': ['O-', 'B-'],
    'B+': ['O-', 'O+', 'B-', 'B+'],
    'AB-': ['O-', 'A-', 'B-', 'AB-'],
    'AB+': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+']
};

/**
 * Checks if a donor can donate blood to a specific recipient
 * based on standard red blood cell compatibility rules.
 */
export function isBloodCompatible(donorGroup: BloodGroup, recipientGroup: BloodGroup): boolean {
    const compatibleDonors = COMPATIBILITY_CHART[recipientGroup];
    return compatibleDonors ? compatibleDonors.includes(donorGroup) : false;
}

/**
 * Returns a list of compatible blood groups that can donate to the given recipient.
 */
export function getCompatibleDonors(recipientGroup: BloodGroup): BloodGroup[] {
    return COMPATIBILITY_CHART[recipientGroup] || [];
}
