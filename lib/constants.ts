// Blood donation constants
export const DONATION_RECOVERY_DAYS = 90; // Standard recovery period between donations

// Achievement thresholds
export const ACHIEVEMENTS = {
    FIRST_TIME_DONOR: {
        threshold: 1,
        name: 'First Time Donor',
        description: 'Completed your first blood donation',
        icon: 'droplet'
    },
    REGULAR_DONOR: {
        threshold: 5,
        name: 'Regular Donor',
        description: 'Donated blood 5 times',
        icon: 'droplet'
    },
    SUPER_DONOR: {
        threshold: 10,
        name: 'Super Donor',
        description: 'Donated blood 10 times',
        icon: 'droplet'
    },
    LIFE_SAVER: {
        name: 'Life Saver',
        description: 'Responded to an urgent request',
        criteria: 'urgent_donation',
        icon: 'heart'
    }
} as const;

// Points system
export const POINTS_PER_DONATION = 50;
