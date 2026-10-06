import { supabase } from './supabase';

export type LogAction =
    | 'CREATE_REQUEST'
    | 'DELETE_REQUEST'
    | 'UPDATE_PROFILE'
    | 'VERIFY_DONATION'
    | 'FULFILL_REQUEST'
    | 'REGISTER_USER';

export type EntityType =
    | 'blood_requests'
    | 'profiles'
    | 'donations'
    | 'auth';

interface LogActivityParams {
    userId: string;
    action: LogAction;
    entityType: EntityType;
    entityId?: string;
    metadata?: Record<string, any>;
}

export const logActivity = async ({ userId, action, entityType, entityId, metadata = {} }: LogActivityParams) => {
    try {
        const { error } = await supabase
            .from('user_activity_logs')
            .insert({
                user_id: userId,
                action,
                entity_type: entityType,
                entity_id: entityId,
                metadata
            });

        if (error) {
            console.error('Failed to log activity:', error);
        }
    } catch (err) {
        console.error('Error logging activity:', err);
    }
};
