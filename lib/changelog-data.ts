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
        version: '0.4.0',
        date: '2025-12-23',
        title: 'Privacy & User Rights',
        description: 'Focused on protecting user data and giving you more control.',
        changes: [
            'Added "Danger Zone" in Profile to allow permanent account deletion.',
            'Refined registration process with explicit privacy consent.',
            'Introduced self-declaration for medical eligibility.',
            'Stopped collection of sensitive documents to minimize data storage.',
            'Made Blood Group selection mandatory for new donors.',
            'Improved "Nearby Donors" with smart auto-location and map optimizations.'
        ],
        type: 'minor'
    },
    {
        version: '0.3.0',
        date: '2025-12-17',
        title: 'Reliable Notifications',
        description: 'Ensuring you never miss an important update or request.',
        changes: [
            'Improved email delivery for welcome messages and password resets.',
            'Enhanced reliability of donation request alerts.',
            'Unified notification system for better performance.'
        ],
        type: 'minor'
    },
    {
        version: '0.2.0',
        date: '2025-12-12',
        title: 'Platform Upgrade',
        description: 'Major infrastructure improvements for a faster experience.',
        changes: [
            'Significantly faster page load times.',
            'Better search engine visibility (SEO) for public requests.',
            'Smoother transitions and animations across the app.',
            'Optimized for mobile devices and slower connections.'
        ],
        type: 'major'
    },
    {
        version: '0.1.0',
        date: '2025-11-20',
        title: 'Beta Launch',
        description: 'First public release of Vital Blood Donation.',
        changes: [
            'Register as a blood donor.',
            'Create and manage blood requests.',
            'Find donors nearby using the interactive map.',
            'Manage your profile and donation availability.'
        ],
        type: 'major'
    },
    {
        version: '0.0.1',
        date: '2025-10-01',
        title: 'Inception',
        description: 'The beginning of the journey.',
        changes: [
            'Project initialization.',
            'Basic concept design and prototyping.'
        ],
        type: 'patch'
    }
];
