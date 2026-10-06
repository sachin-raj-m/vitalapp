"use client";

import React from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { RegistrationGuard } from '@/components/RegistrationGuard';
import { RequestsProvider } from '@/context/RequestsContext';
import { AppShell } from '@/components/SidebarWrapper';

export default function ProtectedLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <ProtectedRoute>
            <RegistrationGuard>
                <RequestsProvider>
                    <AppShell>{children}</AppShell>
                </RequestsProvider>
            </RegistrationGuard>
        </ProtectedRoute>
    );
}
