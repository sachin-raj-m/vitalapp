// Blood donation constants
export const DONATION_RECOVERY_DAYS = 90; // Standard recovery period between donations

// Achievement thresholds
export const ACHIEVEMENTS = {
    FIRST_DROP: {
        id: 'first_drop',
        threshold: 1,
        name: 'First Drop',
        description: 'Completed your first blood donation',
        motto: 'The journey begins with a single drop.',
        points: 50,
        icon: 'droplet',
        type: 'count'
    },
    REGULAR_HERO: {
        id: 'regular_hero',
        threshold: 3,
        name: 'Regular Hero',
        description: 'Completed 3 blood donations',
        motto: 'Consistency saves lives.',
        points: 150,
        icon: 'droplet',
        type: 'count'
    },
    BRONZE_GUARDIAN: {
        id: 'bronze_guardian',
        threshold: 5,
        name: 'Bronze Guardian',
        description: 'Completed 5 blood donations',
        motto: 'A pillar of hope for the community.',
        points: 300,
        icon: 'shield',
        type: 'count'
    },
    SILVER_SAVIOR: {
        id: 'silver_savior',
        threshold: 10,
        name: 'Silver Savior',
        description: 'Completed 10 blood donations',
        motto: 'Double digits, countless smiles.',
        points: 750,
        icon: 'star',
        type: 'count'
    },
    GOLD_LEGEND: {
        id: 'gold_legend',
        threshold: 25,
        name: 'Gold Legend',
        description: 'Completed 25 blood donations',
        motto: 'A lifetime of giving.',
        points: 2000,
        icon: 'trophy',
        type: 'count'
    },
    CRITICAL_RESPONDER: {
        id: 'critical_responder',
        name: 'Critical Responder',
        description: 'Responded to an urgent request',
        motto: 'There when it matters most.',
        points: 500,
        criteria: 'urgent_donation',
        icon: 'heart',
        type: 'special'
    }
} as const;

// Points system
export const POINTS_PER_DONATION = 50;
