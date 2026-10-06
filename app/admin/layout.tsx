"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { PageLoader } from '@/components/PageLoader';
import { SidebarWrapper } from '@/components/SidebarWrapper';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const router = useRouter();
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkAdmin();
    }, [user]);

    const checkAdmin = async () => {
        if (!user) {
            router.push('/login');
            return;
        }

        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single();

            if (data?.role === 'admin') {
                setIsAdmin(true);
            } else {
                router.push('/dashboard');
            }
        } catch (error) {
            console.error('Error checking admin status');
            router.push('/dashboard');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <PageLoader />
        );
    }

    if (!isAdmin) return null;

    return (
        <SidebarWrapper>
            <div className="space-y-6">
                <h1 className="display border-b border-gray-200 pb-6 text-5xl leading-none">Admin</h1>
                {children}
            </div>
        </SidebarWrapper>
    );
}
