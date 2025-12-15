import React from 'react';
import { Card, CardBody } from '../ui/Card';
import { Skeleton } from '../ui/Skeleton';

export const DashboardSkeleton = () => {
    return (
        <div className="space-y-8">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-64" />
                </div>
                <Skeleton className="h-10 w-32 rounded-full" />
            </div>

            {/* Smart Status Section - 3 Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                    <Card key={i} className="h-48">
                        <CardBody className="flex flex-col h-full justify-between">
                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <Skeleton className="h-5 w-24" />
                                    <Skeleton className="h-5 w-5 rounded-full" />
                                </div>
                                <Skeleton className="h-8 w-16" />
                                <Skeleton className="h-4 w-32" />
                            </div>
                            <Skeleton className="h-9 w-full mt-4" />
                        </CardBody>
                    </Card>
                ))}
            </div>

            {/* Smart Matches / Feed */}
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <Skeleton className="h-7 w-48" />
                    <Skeleton className="h-4 w-24" />
                </div>

                <div className="space-y-4">
                    {[1, 2].map((i) => (
                        // Reusing the structure conceptually, but inline for simplicity or import RequestCardSkeleton
                        <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 space-y-4">
                            <div className="flex items-center space-x-4">
                                <Skeleton className="w-10 h-10 rounded-full" />
                                <div className="space-y-2 flex-1">
                                    <Skeleton className="h-5 w-1/3" />
                                    <Skeleton className="h-4 w-1/4" />
                                </div>
                            </div>
                            <Skeleton className="h-20 w-full rounded-lg" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
