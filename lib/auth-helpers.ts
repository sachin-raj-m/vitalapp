import { supabase } from '../lib/supabase';

export async function isRegistrationComplete(userId: string): Promise<boolean> {
    try {

        const { data: profile, error } = await supabase
            .from('profiles')
            .select('full_name, phone, city, district')
            .eq('id', userId)
            .single();

        if (error) {
            console.error('Error fetching profile:', error);
            throw error;
        }



        const isComplete = !!(
            profile &&
            profile.full_name &&
            profile.phone &&
            profile.city &&
            profile.district
        );

        return isComplete;
    } catch (error) {
        console.error('Error checking registration status:', error);
        return false;
    }
} 