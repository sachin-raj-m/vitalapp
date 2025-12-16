"use client";

import React from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';

interface AnalyticsChartsProps {
    users: any[];
    requests: any[];
    donations: any[];
}

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7'];
const STATUS_COLORS = {
    active: '#eab308', // yellow
    fulfilled: '#22c55e', // green
    withdrawn: '#6b7280', // gray
    cancelled: '#ef4444' // red
};

export function AnalyticsCharts({ users, requests, donations }: AnalyticsChartsProps) {
    // 1. User Growth (Signups per month/day)
    // Simplified: Group by date (MM/DD) for last 30 days
    const getUserGrowthData = () => {
        const growthMap = new Map<string, number>();

        users.forEach(u => {
            const date = new Date(u.created_at).toLocaleDateString();
            growthMap.set(date, (growthMap.get(date) || 0) + 1);
        });

        // Convert to array and sort
        return Array.from(growthMap.entries())
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .slice(-14); // Last 14 active days
    };

    // 2. Request Status Distribution
    const getRequestStatusData = () => {
        const stats = { active: 0, fulfilled: 0, withdrawn: 0, cancelled: 0 };
        requests.forEach(r => {
            if (stats[r.status as keyof typeof stats] !== undefined) {
                stats[r.status as keyof typeof stats]++;
            }
        });

        return [
            { name: 'Active', value: stats.active, color: STATUS_COLORS.active },
            { name: 'Fulfilled', value: stats.fulfilled, color: STATUS_COLORS.fulfilled },
            { name: 'Cancelled/Withdrawn', value: stats.withdrawn + stats.cancelled, color: STATUS_COLORS.withdrawn },
        ].filter(d => d.value > 0);
    };

    // 3. Blood Group Distribution (Donors)
    const getBloodGroupData = () => {
        const groups: Record<string, number> = {};
        users.forEach(u => {
            if (u.blood_group) {
                groups[u.blood_group] = (groups[u.blood_group] || 0) + 1;
            }
        });

        return Object.entries(groups).map(([name, value]) => ({ name, value }));
    };

    const growthData = getUserGrowthData();
    const statusData = getRequestStatusData();
    const bloodGroupData = getBloodGroupData();

    return (
        <div className="space-y-6 mb-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* User Growth Chart */}
                <Card className="min-h-[350px]">
                    <CardHeader>
                        <h3 className="font-semibold text-gray-700">User Growth Trend</h3>
                    </CardHeader>
                    <CardBody className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={growthData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                <XAxis dataKey="date" fontSize={12} tickMargin={10} stroke="#9ca3af" />
                                <YAxis fontSize={12} stroke="#9ca3af" />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Line type="monotone" dataKey="count" stroke="#ef4444" strokeWidth={3} dot={{ stroke: '#ef4444', strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardBody>
                </Card>

                {/* Request Status Breakdown */}
                <Card className="min-h-[350px]">
                    <CardHeader>
                        <h3 className="font-semibold text-gray-700">Request Outcomes</h3>
                    </CardHeader>
                    <CardBody className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={statusData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {statusData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardBody>
                </Card>
            </div>

            {/* Blood Group Distribution */}
            <Card className="min-h-[350px]">
                <CardHeader>
                    <h3 className="font-semibold text-gray-700">Donor Blood Group Distribution</h3>
                </CardHeader>
                <CardBody className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={bloodGroupData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                            <XAxis dataKey="name" fontSize={12} stroke="#9ca3af" />
                            <YAxis fontSize={12} stroke="#9ca3af" />
                            <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                            <Bar dataKey="value" fill="#ef4444" radius={[4, 4, 0, 0]}>
                                {bloodGroupData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </CardBody>
            </Card>
        </div>
    );
}
