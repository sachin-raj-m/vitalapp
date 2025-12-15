"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { BloodRequest } from '@/types';
import { useAuth } from './AuthContext';

interface RequestsContextType {
    requests: BloodRequest[]; // Active requests
    loading: boolean;
    error: Error | null;
    refreshRequests: () => Promise<void>;
}

const RequestsContext = createContext<RequestsContextType | undefined>(undefined);

export function RequestsProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth(); // We might need user for RLS, or generally to trigger fetch on auth change
    const [requests, setRequests] = useState<BloodRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const fetchRequests = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            // Centralized fetch: Only Active requests, newest first
            const { data, error: supabaseError } = await supabase
                .from('blood_requests')
                .select('*')
                .eq('status', 'active')
                .order('created_at', { ascending: false });

            if (supabaseError) throw supabaseError;

            setRequests(data as BloodRequest[] || []);
        } catch (err: any) {
            console.error('Error in RequestsContext:', err);
            setError(err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Fetch on mount or when user changes (e.g. login/logout could change RLS visibility)
    useEffect(() => {
        fetchRequests();

        // Optional: Real-time subscription could go here
        const channel = supabase
            .channel('public_requests')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'blood_requests' },
                () => {
                    console.log('Real-time update: Refreshing requests...');
                    fetchRequests();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchRequests, user]);

    const value = {
        requests,
        loading,
        error,
        refreshRequests: fetchRequests
    };

    return <RequestsContext.Provider value={value}>{children}</RequestsContext.Provider>;
}

export const useRequests = () => {
    const context = useContext(RequestsContext);
    if (context === undefined) {
        throw new Error('useRequests must be used within a RequestsProvider');
    }
    return context;
};
