"use client";

import React from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { RegistrationGuard } from '@/components/RegistrationGuard';
import { VerificationBanner } from '@/components/VerificationBanner';

import { RequestsProvider } from '@/context/RequestsContext';

export default function ProtectedLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <ProtectedRoute>
            <RegistrationGuard>
                <RequestsProvider>
                    <div className="flex flex-col min-h-screen">
                        <VerificationBanner />
                        {children}
                    </div>
                </RequestsProvider>
            </RegistrationGuard>
        </ProtectedRoute>
    );
}
