"use client";

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { AppSidebar } from '@/components/AppSidebar';
import { VerificationBanner } from '@/components/VerificationBanner';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export function AppShell({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-screen flex-col md:flex-row">
            <AppSidebar />
            <main className="flex-1 md:ml-60">
                <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 md:px-10 md:py-10">
                    <VerificationBanner />
                    {children}
                </div>
            </main>
        </div>
    );
}

export function SidebarWrapper({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();

    // Only branch on whether a user exists. Branching on `loading` as well would
    // swap the layout (and remount the page) every time the profile refreshes.
    if (!user) {
        return (
            <>
                <Header />
                <main className="flex-grow">
                    <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8">{children}</div>
                </main>
                <Footer />
            </>
        );
    }

    return <AppShell>{children}</AppShell>;
}
