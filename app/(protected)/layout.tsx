"use client";

import React from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { RegistrationGuard } from '@/components/RegistrationGuard';
import { VerificationBanner } from '@/components/VerificationBanner';

import { RequestsProvider } from '@/context/RequestsContext';

import { AppSidebar } from '@/components/AppSidebar';

export default function ProtectedLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <ProtectedRoute>
            <RegistrationGuard>
                <RequestsProvider>
                    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
                        <AppSidebar />
                        <main className="flex-1 md:ml-64 transition-all duration-300">
                            <div className="max-w-7xl mx-auto p-4 md:p-8">
                                <VerificationBanner />
                                {children}
                            </div>
                        </main>
                    </div>
                </RequestsProvider>
            </RegistrationGuard>
        </ProtectedRoute>
    );
}
