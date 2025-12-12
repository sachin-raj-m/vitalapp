"use client";

import React from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { RegistrationGuard } from '@/components/RegistrationGuard';

export default function ProtectedLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <ProtectedRoute>
            <RegistrationGuard>
                {children}
            </RegistrationGuard>
        </ProtectedRoute>
    );
}
