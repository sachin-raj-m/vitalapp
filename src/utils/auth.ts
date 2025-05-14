import { supabase } from '../lib/supabase';

export async function isRegistrationComplete(userId: string): Promise<boolean> {
    try {
        console.log('Checking registration completion for user:', userId);
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('full_name, blood_group, blood_group_proof_url')
            .eq('id', userId)
            .single();

        if (error) {
            console.error('Error fetching profile:', error);
            throw error;
        }

        console.log('Profile data:', profile);

        const isComplete = !!(
            profile &&
            profile.full_name &&
            profile.blood_group &&
            profile.blood_group_proof_url
        );

        console.log('Registration complete?', isComplete);
        return isComplete;
    } catch (error) {
        console.error('Error checking registration status:', error);
        return false;
    }
} 