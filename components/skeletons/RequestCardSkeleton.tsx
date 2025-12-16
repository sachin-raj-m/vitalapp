import React from 'react';
import { Card, CardBody } from '../ui/Card';
import { Skeleton } from '../ui/Skeleton';

export const RequestCardSkeleton = () => {
    return (
        <Card className="overflow-hidden border-l-4 border-gray-200">
            <CardBody className="p-0">
                <div className="p-4">
                    {/* Header: Blood Group + Name */}
                    <div className="flex justify-between items-start">
                        <div className="flex items-center">
                            {/* Blood Group Circle */}
                            <Skeleton className="w-10 h-10 rounded-full" />
                            <div className="ml-3 space-y-2">
                                {/* Units + Needed */}
                                <Skeleton className="h-5 w-32" />
                                {/* Contact Name */}
                                <Skeleton className="h-4 w-24" />
                            </div>
                        </div>
                        {/* Priority Badge */}
                        <Skeleton className="h-6 w-20 ml-2 rounded-full" />
                    </div>

                    {/* Details: Hospital, Time, Date Needed */}
                    <div className="mt-4 space-y-2">
                        <div className="flex items-center">
                            <Skeleton className="h-4 w-4 mr-2" />
                            <Skeleton className="h-4 w-48" />
                        </div>
                        <div className="flex items-center">
                            <Skeleton className="h-4 w-4 mr-2" />
                            <Skeleton className="h-4 w-32" />
                        </div>
                        <div className="flex items-center">
                            <Skeleton className="h-4 w-4 mr-2" />
                            <Skeleton className="h-4 w-40" />
                        </div>
                    </div>

                    {/* Footer: Action Button */}
                    <div className="mt-4 flex justify-between items-center gap-2">
                        {/* Share Button Placeholder */}
                        <Skeleton className="h-8 w-20" />
                        {/* Donate Button Placeholder */}
                        <Skeleton className="h-8 w-28" />
                    </div>
                </div>
            </CardBody>
        </Card>
    );
};
