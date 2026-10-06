import React from 'react';
import { Skeleton } from '../ui/Skeleton';
import { RequestCardSkeleton } from './RequestCardSkeleton';

export const DashboardSkeleton = () => (
    <div className="space-y-10">
        <div className="space-y-3">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-12 w-72" />
        </div>
        <div className="grid gap-px overflow-hidden rounded-lg border border-gray-200 bg-gray-200 sm:grid-cols-3">
            {[1, 2, 3].map(i => (
                <div key={i} className="space-y-4 bg-white p-6">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-8 w-32" />
                </div>
            ))}
        </div>
        <div className="space-y-3">
            <Skeleton className="h-5 w-56" />
            <RequestCardSkeleton />
            <RequestCardSkeleton />
        </div>
    </div>
);
