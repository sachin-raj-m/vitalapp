import { supabase } from './supabase';
import { ACHIEVEMENTS, DONATION_RECOVERY_DAYS } from './constants';

export interface UserStats {
    total_donations: number;
    total_requests: number;
    last_donation_date: string | null;
    achievements: string[];
}

export interface AchievementData {
    name: string;
    unlocked: boolean;
    unlockedDate?: string;
    description: string;
    icon: string;
}

/**
 * Fetch comprehensive user statistics from database
 */
export async function fetchUserStats(userId: string): Promise<UserStats> {
    // Fetch donations with related request data
    const { data: donations, error: donationsError } = await supabase
        .from('donations')
        .select('created_at, status, blood_requests(urgency_level)')
        .eq('donor_id', userId)
        .order('created_at', { ascending: false });

    if (donationsError) throw donationsError;

    // Fetch blood requests posted by user
    const { data: requests, error: requestsError } = await supabase
        .from('blood_requests')
        .select('created_at', { count: 'exact' })
        .eq('user_id', userId);

    if (requestsError) throw requestsError;

    // Calculate achievements based on actual donations
    const achievements = calculateAchievements(donations || []);

    // Get last completed donation date
    const completedDonations = (donations || []).filter(d => d.status === 'completed');
    const lastDonation = completedDonations[0];

    return {
        total_donations: completedDonations.length,
        total_requests: requests?.length || 0,
        last_donation_date: lastDonation?.created_at || null,
        achievements
    };
}

/**
 * Calculate achievements based on donation history
 */
export function calculateAchievements(donations: any[]): string[] {
    const achievements: string[] = [];
    const completedDonations = donations.filter(d => d.status === 'completed');

    // First Time Donor
    if (completedDonations.length >= ACHIEVEMENTS.FIRST_TIME_DONOR.threshold) {
        achievements.push(ACHIEVEMENTS.FIRST_TIME_DONOR.name);
    }

    // Regular Donor
    if (completedDonations.length >= ACHIEVEMENTS.REGULAR_DONOR.threshold) {
        achievements.push(ACHIEVEMENTS.REGULAR_DONOR.name);
    }

    // Super Donor
    if (completedDonations.length >= ACHIEVEMENTS.SUPER_DONOR.threshold) {
        achievements.push(ACHIEVEMENTS.SUPER_DONOR.name);
    }

    // Life Saver - responded to urgent/critical request
    const hasUrgentDonation = completedDonations.some(d => {
        const request = Array.isArray(d.blood_requests) ? d.blood_requests[0] : d.blood_requests;
        return request?.urgency_level === 'critical' || request?.urgency_level === 'urgent';
    });
    if (hasUrgentDonation) {
        achievements.push(ACHIEVEMENTS.LIFE_SAVER.name);
    }

    return achievements;
}

/**
 * Get detailed achievement data with unlock dates
 */
export async function fetchDetailedAchievements(userId: string): Promise<AchievementData[]> {
    const { data: donations } = await supabase
        .from('donations')
        .select('created_at, status, blood_requests(urgency_level)')
        .eq('donor_id', userId)
        .eq('status', 'completed')
        .order('created_at', { ascending: true });

    const completedDonations = donations || [];
    const achievementsList: AchievementData[] = [];

    // First Time Donor
    if (completedDonations.length > 0) {
        achievementsList.push({
            name: ACHIEVEMENTS.FIRST_TIME_DONOR.name,
            unlocked: true,
            unlockedDate: completedDonations[0].created_at,
            description: ACHIEVEMENTS.FIRST_TIME_DONOR.description,
            icon: ACHIEVEMENTS.FIRST_TIME_DONOR.icon
        });
    } else {
        achievementsList.push({
            name: ACHIEVEMENTS.FIRST_TIME_DONOR.name,
            unlocked: false,
            description: ACHIEVEMENTS.FIRST_TIME_DONOR.description,
            icon: ACHIEVEMENTS.FIRST_TIME_DONOR.icon
        });
    }

    // Regular Donor
    if (completedDonations.length >= ACHIEVEMENTS.REGULAR_DONOR.threshold) {
        achievementsList.push({
            name: ACHIEVEMENTS.REGULAR_DONOR.name,
            unlocked: true,
            unlockedDate: completedDonations[ACHIEVEMENTS.REGULAR_DONOR.threshold - 1].created_at,
            description: ACHIEVEMENTS.REGULAR_DONOR.description,
            icon: ACHIEVEMENTS.REGULAR_DONOR.icon
        });
    } else {
        achievementsList.push({
            name: ACHIEVEMENTS.REGULAR_DONOR.name,
            unlocked: false,
            description: `${ACHIEVEMENTS.REGULAR_DONOR.description} (${completedDonations.length}/${ACHIEVEMENTS.REGULAR_DONOR.threshold})`,
            icon: ACHIEVEMENTS.REGULAR_DONOR.icon
        });
    }

    // Super Donor
    if (completedDonations.length >= ACHIEVEMENTS.SUPER_DONOR.threshold) {
        achievementsList.push({
            name: ACHIEVEMENTS.SUPER_DONOR.name,
            unlocked: true,
            unlockedDate: completedDonations[ACHIEVEMENTS.SUPER_DONOR.threshold - 1].created_at,
            description: ACHIEVEMENTS.SUPER_DONOR.description,
            icon: ACHIEVEMENTS.SUPER_DONOR.icon
        });
    } else {
        achievementsList.push({
            name: ACHIEVEMENTS.SUPER_DONOR.name,
            unlocked: false,
            description: `${ACHIEVEMENTS.SUPER_DONOR.description} (${completedDonations.length}/${ACHIEVEMENTS.SUPER_DONOR.threshold})`,
            icon: ACHIEVEMENTS.SUPER_DONOR.icon
        });
    }

    // Life Saver
    const urgentDonation = completedDonations.find(d => {
        const request = Array.isArray(d.blood_requests) ? d.blood_requests[0] : d.blood_requests;
        return request?.urgency_level === 'critical' || request?.urgency_level === 'urgent';
    });
    if (urgentDonation) {
        achievementsList.push({
            name: ACHIEVEMENTS.LIFE_SAVER.name,
            unlocked: true,
            unlockedDate: urgentDonation.created_at,
            description: ACHIEVEMENTS.LIFE_SAVER.description,
            icon: ACHIEVEMENTS.LIFE_SAVER.icon
        });
    } else {
        achievementsList.push({
            name: ACHIEVEMENTS.LIFE_SAVER.name,
            unlocked: false,
            description: ACHIEVEMENTS.LIFE_SAVER.description,
            icon: ACHIEVEMENTS.LIFE_SAVER.icon
        });
    }

    return achievementsList;
}

/**
 * Calculate eligibility status for next donation
 */
export function calculateEligibility(lastDonationDate: string | null) {
    if (!lastDonationDate) {
        return {
            isEligible: true,
            daysRemaining: 0,
            nextEligibleDate: new Date(),
            distinctText: "You are eligible to donate today!"
        };
    }

    const lastDate = new Date(lastDonationDate);
    const nextDate = new Date(lastDate);
    nextDate.setDate(lastDate.getDate() + DONATION_RECOVERY_DAYS);

    const today = new Date();
    const diffTime = nextDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
        return {
            isEligible: true,
            daysRemaining: 0,
            nextEligibleDate: today,
            distinctText: "You represent a ready hope for someone in need."
        };
    } else {
        return {
            isEligible: false,
            daysRemaining: diffDays,
            nextEligibleDate: nextDate,
            distinctText: `Next eligibility in ${diffDays} days.`
        };
    }
}
