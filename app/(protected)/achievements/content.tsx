"use client";

import React from 'react';
import { AchievementDisplay } from '@/components/AchievementDisplay';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { Achievement, Badge as BadgeType } from '@/types';

export default function AchievementsPage() {
    const achievements: Achievement[] = [
        {
            id: '1',
            user_id: '1',
            badge_id: '1',
            earned_date: '2024-03-15',
            badge: {
                id: '1',
                name: 'First Time Donor',
                description: 'Completed your first blood donation',
                image_url: 'https://example.com/badge1.png',
                points: 100,
                criteria: 'Complete first donation'
            }
        }
    ];

    const allBadges: BadgeType[] = [
        {
            id: '1',
            name: 'First Time Donor',
            description: 'Completed your first blood donation',
            image_url: 'https://example.com/badge1.png',
            points: 100,
            criteria: 'Complete first donation'
        },
        {
            id: '2',
            name: 'Regular Donor',
            description: 'Donated blood 5 times',
            image_url: 'https://example.com/badge2.png',
            points: 500,
            criteria: 'Complete 5 donations'
        },
        {
            id: '3',
            name: 'Life Saver',
            description: 'Responded to an urgent request',
            image_url: 'https://example.com/badge3.png',
            points: 300,
            criteria: 'Complete urgent donation'
        }
    ];

    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold text-gray-900">Achievements</h1>

            <div className="grid md:grid-cols-3 gap-6">
                <Card>
                    <CardHeader>
                        <h3 className="text-lg font-medium text-gray-900">Total Points</h3>
                    </CardHeader>
                    <CardBody>
                        <div className="text-3xl font-bold text-primary-500">350</div>
                        <p className="text-sm text-gray-500">Points earned</p>
                    </CardBody>
                </Card>

                <Card>
                    <CardHeader>
                        <h3 className="text-lg font-medium text-gray-900">Badges Earned</h3>
                    </CardHeader>
                    <CardBody>
                        <div className="text-3xl font-bold text-secondary-500">3/10</div>
                        <p className="text-sm text-gray-500">Progress</p>
                    </CardBody>
                </Card>

                <Card>
                    <CardHeader>
                        <h3 className="text-lg font-medium text-gray-900">Rank</h3>
                    </CardHeader>
                    <CardBody>
                        <div className="text-3xl font-bold text-accent-500">Silver</div>
                        <p className="text-sm text-gray-500">Current tier</p>
                    </CardBody>
                </Card>
            </div>

            <AchievementDisplay
                achievements={achievements}
                allBadges={allBadges}
            />

            <Card>
                <CardHeader>
                    <h3 className="text-lg font-medium text-gray-900">Available Rewards</h3>
                </CardHeader>
                <CardBody>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="p-4 border rounded-lg">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h4 className="font-medium">Coffee Shop Voucher</h4>
                                    <p className="text-sm text-gray-500">Get a free coffee at any branch</p>
                                </div>
                                <Badge variant="primary">200 pts</Badge>
                            </div>
                        </div>
                        <div className="p-4 border rounded-lg">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h4 className="font-medium">Movie Tickets</h4>
                                    <p className="text-sm text-gray-500">Two free movie tickets</p>
                                </div>
                                <Badge variant="primary">500 pts</Badge>
                            </div>
                        </div>
                    </div>
                </CardBody>
            </Card>
        </div>
    );
}
