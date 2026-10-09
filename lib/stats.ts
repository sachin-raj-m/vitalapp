import { supabase } from './supabase';
import { ACHIEVEMENTS, DONATION_RECOVERY_DAYS, POINTS_PER_DONATION } from './constants';
import { REFERRAL_POINTS } from './referrals';

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
    type: 'count' | 'special';
}

/**
 * Points breakdown. Scoring rule (points are private to the user and have no
 * exchange value):
 *   - POINTS_PER_DONATION (50) for every completed donation, regardless of
 *     units given (cancelled and pending offers score nothing), plus
 *   - a one-time bonus for every milestone reached (ACHIEVEMENTS[*].points), plus
 *   - REFERRAL_POINTS (25) for every donor who registered with the user's link.
 * So one completed donation = 50 + 50 (First Drop bonus) = 100 points.
 */
export interface PointsBreakdown {
    donations: number;      // completed donations counted
    donation_points: number; // donations * POINTS_PER_DONATION
    bonus_points: number;   // sum of unlocked milestone bonuses
    milestones: number;     // milestones reached
    referrals: number;      // donors who registered with the user's link
    referral_points: number; // referrals * REFERRAL_POINTS
    total: number;          // donation_points + bonus_points + referral_points
}

export interface UserStats {
    total_donations: number;
    total_requests: number;
    total_referrals: number;
    /** Always equals points.total. */
    total_points: number;
    points: PointsBreakdown;
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

    // Donors who joined with this user's link (0 if the lookup fails).
    const { data: referralCount } = await supabase.rpc('get_my_referral_count');
    const referrals = Number(referralCount ?? 0) || 0;

    const completedDonations = (donations || []).filter(d => d.status === 'completed');
    const achievements = calculateAchievements(donations || []);
    const points = calculatePoints(completedDonations.length, achievements, referrals);

    const lastDonation = completedDonations[0];

    return {
        total_donations: completedDonations.length,
        total_requests: requests?.length || 0,
        total_referrals: referrals,
        total_points: points.total,
        points,
        last_donation_date: lastDonation?.created_at || null,
        achievements
    };
}

/** Pure scoring: see PointsBreakdown for the rule. */
export function calculatePoints(completedDonations: number, achievements: Pick<Achievement, 'unlocked' | 'points'>[], referrals = 0): PointsBreakdown {
    const reached = achievements.filter(a => a.unlocked);
    const donation_points = completedDonations * POINTS_PER_DONATION;
    const bonus_points = reached.reduce((sum, a) => sum + a.points, 0);
    const referral_points = referrals * REFERRAL_POINTS;
    return {
        donations: completedDonations,
        donation_points,
        bonus_points,
        milestones: reached.length,
        referrals,
        referral_points,
        total: donation_points + bonus_points + referral_points,
    };
}

/** "50 for 1 donation + 50 milestone bonus = 100 points" */
export function describePoints(p: PointsBreakdown): string {
    if (p.total === 0) return '0 points';
    const parts = [`${p.donation_points} for ${p.donations} ${p.donations === 1 ? 'donation' : 'donations'}`];
    if (p.bonus_points > 0) parts.push(`${p.bonus_points} milestone bonus`);
    if (p.referral_points > 0) parts.push(`${p.referral_points} for ${p.referrals} ${p.referrals === 1 ? 'donor' : 'donors'} invited`);
    return `${parts.join(' + ')} = ${p.total} points`;
}

export function calculateAchievements(donations: any[]): Achievement[] {
    // Newest first, so the Nth donation (and its date) is found regardless of input order.
    // Note: dates are when the offer was made; donations has no completion timestamp.
    const completedDonations = donations
        .filter(d => d.status === 'completed')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

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
                // Earliest completed donation on a High-urgency request.
                const urgentDonation = [...completedDonations].reverse().find(d => {
                    const request = Array.isArray(d.blood_requests) ? d.blood_requests[0] : d.blood_requests;
                    return request?.urgency_level === 'High';
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
            threshold: badge.type === 'count' ? badge.threshold : undefined,
            type: badge.type
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
