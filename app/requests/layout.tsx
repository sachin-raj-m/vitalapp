"use client";

import React from 'react';
import { RequestsProvider } from '@/context/RequestsContext';

import { SidebarWrapper } from '@/components/SidebarWrapper';

export default function RequestsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <React.Fragment>
            <SidebarWrapper>
                <RequestsProvider>
                    {children}
                </RequestsProvider>
            </SidebarWrapper>
        </React.Fragment>
    );
}
