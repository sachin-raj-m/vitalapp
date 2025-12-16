"use client";

import React from 'react';
import { RequestsProvider } from '@/context/RequestsContext';

export default function RequestsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <RequestsProvider>
            {children}
        </RequestsProvider>
    );
}
