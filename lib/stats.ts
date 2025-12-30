import { supabase } from './supabase';
import { ACHIEVEMENTS, DONATION_RECOVERY_DAYS, POINTS_PER_DONATION } from './constants';

export interface Achievement {
    id: string;
    name: string;
    description: string;
    motto: string;
    points: number;
    icon: string;
    unlocked: boolean;
    unlockedDate?: string;
    progress: number;
    threshold?: number;
}

export interface UserStats {
    total_donations: number;
    total_requests: number;
    total_points: number;
    last_donation_date: string | null;
    achievements: Achievement[];
}

export async function fetchUserStats(userId: string): Promise<UserStats> {
    // Fetch donations
    const { data: donations, error: donationsError } = await supabase
        .from('donations')
        .select('created_at, status, blood_requests(urgency_level)')
        .eq('donor_id', userId)
        .order('created_at', { ascending: false });

    if (donationsError) throw donationsError;

    // Fetch requests
    const { data: requests, error: requestsError } = await supabase
        .from('blood_requests')
        .select('created_at', { count: 'exact' })
        .eq('user_id', userId);

    if (requestsError) throw requestsError;

    const completedDonations = (donations || []).filter(d => d.status === 'completed');
    const achievements = calculateAchievements(donations || []);

    // Calculate total points
    // Base points for donations
    let totalPoints = completedDonations.length * POINTS_PER_DONATION;
    // Add bonus points for unlocked achievements
    achievements.forEach(ach => {
        if (ach.unlocked) {
            totalPoints += ach.points;
        }
    });

    const lastDonation = completedDonations[0];

    return {
        total_donations: completedDonations.length,
        total_requests: requests?.length || 0,
        total_points: totalPoints,
        last_donation_date: lastDonation?.created_at || null,
        achievements
    };
}

export function calculateAchievements(donations: any[]): Achievement[] {
    const completedDonations = donations.filter(d => d.status === 'completed');

    return Object.values(ACHIEVEMENTS).map(badge => {
        let unlocked = false;
        let unlockedDate: string | undefined;
        let progress = 0;

        if (badge.type === 'count') {
            const count = completedDonations.length;
            const threshold = badge.threshold;
            progress = Math.min(count, threshold);
            unlocked = count >= threshold;

            if (unlocked) {
                // Find the Nth donation (1-based index N = threshold)
                // Array is Descending (Newest...Oldest)
                const index = count - threshold;
                if (index >= 0 && index < count) {
                    unlockedDate = completedDonations[index].created_at;
                }
            }
        } else if (badge.type === 'special') {
            // For now only 'urgent_donation'
            if ((badge as any).criteria === 'urgent_donation') {
                const urgentDonation = completedDonations.find(d => {
                    const request = Array.isArray(d.blood_requests) ? d.blood_requests[0] : d.blood_requests;
                    return request?.urgency_level === 'critical' || request?.urgency_level === 'urgent';
                });
                if (urgentDonation) {
                    unlocked = true;
                    unlockedDate = urgentDonation.created_at;
                    progress = 1;
                }
            }
        }

        return {
            id: badge.id,
            name: badge.name,
            description: badge.description,
            motto: badge.motto,
            points: badge.points,
            icon: badge.icon,
            unlocked,
            unlockedDate,
            progress,
            threshold: badge.type === 'count' ? badge.threshold : undefined
        };
    });
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
