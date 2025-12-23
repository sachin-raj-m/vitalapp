export interface ChangelogEntry {
    version: string;
    date: string;
    title: string;
    description: string;
    changes: string[];
    type: 'major' | 'minor' | 'patch';
}

export const CHANGELOG_DATA: ChangelogEntry[] = [
    {
        version: '1.3.0',
        date: '2025-12-23',
        title: 'Privacy & DPDP Compliance',
        description: 'Major update focusing on data privacy, user rights, and compliance with Digital Personal Data Protection laws.',
        changes: [
            'Refined Registration: Added State field & Medical Self-Declaration.',
            'Explicit Consent: DPDP-compliant consent mechanism with retention policy.',
            'Account Deletion: Users can now permanently delete their account via "Danger Zone".',
            'Data Minimization: Removed collection of sensitive IDs and proof documents.'
        ],
        type: 'major'
    },
    {
        version: '1.2.0',
        date: '2025-12-17',
        title: 'Zoho SMTP Integration',
        description: 'Improved email delivery reliability by integrating Zoho Mail SMTP.',
        changes: [
            'Migrated from Resend to Zoho Mail for transactional emails.',
            'implemented robust SMTP email helper with error handling.',
            'Refactored all email API routes to use the new reusable helper.',
            'Fixed build issues related to type definitions.'
        ],
        type: 'minor'
    },
    {
        version: '1.1.0',
        date: '2025-12-12',
        title: 'Next.js Migration',
        description: 'Complete overhaul of the application infrastructure for better performance and SEO.',
        changes: [
            'Migrated entire codebase from Vite+React to Next.js 14.',
            'Implemented server-side rendering for critical pages.',
            'Enhanced SEO with dynamic metadata and Open Graph support.',
            'Optimized image loading and font strategies.'
        ],
        type: 'major'
    },
    {
        version: '1.0.0',
        date: '2025-11-20',
        title: 'Initial Launch',
        description: 'Official release of the Vital Blood Donation platform.',
        changes: [
            'Core donor registration and search functionality.',
            'Real-time blood request system.',
            'Interactive map for locating donors.',
            'User authentication and profile management.'
        ],
        type: 'major'
    }
];
