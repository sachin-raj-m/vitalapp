import React from 'react';
import { Skeleton } from '../ui/Skeleton';

export const RequestCardSkeleton = () => (
    <div className="flex gap-5 rounded-lg border border-gray-200 bg-white p-5">
        <Skeleton className="h-[4.5rem] w-[4.5rem] shrink-0 rounded-md" />
        <div className="flex-1 space-y-3 pt-1">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <div className="flex justify-between pt-2">
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-8 w-28" />
            </div>
        </div>
    </div>
);
