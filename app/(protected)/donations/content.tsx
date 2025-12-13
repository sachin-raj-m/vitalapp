"use client";

import React from 'react';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/context/AuthContext';

export default function DonationsPage() {
    const { user } = useAuth();

    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold text-gray-900">My Donations</h1>

            <div className="grid md:grid-cols-3 gap-6">
                <Card>
                    <CardHeader>
                        <h3 className="text-lg font-medium text-gray-900">Total Donations</h3>
                    </CardHeader>
                    <CardBody>
                        <div className="text-3xl font-bold text-primary-500">5</div>
                        <p className="text-sm text-gray-500">Lives impacted</p>
                    </CardBody>
                </Card>

                <Card>
                    <CardHeader>
                        <h3 className="text-lg font-medium text-gray-900">Points Earned</h3>
                    </CardHeader>
                    <CardBody>
                        <div className="text-3xl font-bold text-secondary-500">250</div>
                        <p className="text-sm text-gray-500">Reward points</p>
                    </CardBody>
                </Card>

                <Card>
                    <CardHeader>
                        <h3 className="text-lg font-medium text-gray-900">Next Available</h3>
                    </CardHeader>
                    <CardBody>
                        <div className="text-3xl font-bold text-success-500">Ready</div>
                        <p className="text-sm text-gray-500">You can donate again</p>
                    </CardBody>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <h3 className="text-lg font-medium text-gray-900">Donation History</h3>
                </CardHeader>
                <CardBody>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 border-b">
                            <div>
                                <p className="font-medium">City General Hospital</p>
                                <p className="text-sm text-gray-500">March 15, 2024</p>
                            </div>
                            <Badge variant="success">Completed</Badge>
                        </div>
                        <div className="flex items-center justify-between p-4 border-b">
                            <div>
                                <p className="font-medium">Memorial Hospital</p>
                                <p className="text-sm text-gray-500">January 10, 2024</p>
                            </div>
                            <Badge variant="success">Completed</Badge>
                        </div>
                    </div>
                </CardBody>
            </Card>
        </div>
    );
}
