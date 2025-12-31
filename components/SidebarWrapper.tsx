"use client";

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { AppSidebar } from '@/components/AppSidebar';
import { VerificationBanner } from '@/components/VerificationBanner';

import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export function SidebarWrapper({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();

    // If not logged in, render with Public Header/Footer (since RootLayout no longer provides them)
    if (loading || !user) {
        return (
            <>
                <Header />
                <main className="flex-grow">
                    <div className="container mx-auto px-4 py-8">{children}</div>
                </main>
                <Footer />
            </>
        );
    }

    // If logged in, wrap in Sidebar Layout
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
            <AppSidebar />
            <main className="flex-1 md:ml-64 transition-all duration-300">
                <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
                    <VerificationBanner />
                    {children}
                </div>
            </main>
        </div>
    );
}
