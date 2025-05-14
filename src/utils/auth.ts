import { supabase } from '../lib/supabase';

export async function isRegistrationComplete(userId: string): Promise<boolean> {
    try {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('full_name, blood_group, blood_group_proof_url')
            .eq('id', userId)
            .single();

        if (error) throw error;

        return !!(
            profile &&
            profile.full_name &&
            profile.blood_group &&
            profile.blood_group_proof_url
        );
    } catch (error) {
        console.error('Error checking registration status:', error);
        return false;
    }
} 