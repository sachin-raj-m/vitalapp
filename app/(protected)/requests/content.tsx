"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { BloodRequestCard } from '@/components/BloodRequestCard';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import type { BloodRequest } from '@/types';

export default function RequestsPage() {
    const { user } = useAuth();
    const [requests, setRequests] = useState<BloodRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [filters, setFilters] = useState({
        bloodGroup: 'all',
        urgency: 'all',
        location: ''
    });

    useEffect(() => {
        fetchRequests();
    }, []);

    const fetchRequests = async () => {
        try {
            setLoading(true);
            let query = supabase
                .from('blood_requests')
                .select('*')
                .eq('status', 'active')
                .order('created_at', { ascending: false });

            if (filters.bloodGroup !== 'all') {
                query = query.eq('blood_group', filters.bloodGroup);
            }
            if (filters.urgency !== 'all') {
                query = query.eq('urgency_level', filters.urgency);
            }
            // TODO: Implement location filtering

            const { data, error: requestError } = await query;

            if (requestError) throw requestError;
            setRequests(data as BloodRequest[]);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRespond = async (requestId: string) => {
        // TODO: Implement donation response logic
        console.log('Responding to request:', requestId);
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-900">Blood Requests</h1>
                {user && (
                    <Link href="/requests/new">
                        <Button variant="primary">
                            Create Request
                        </Button>
                    </Link>
                )}
            </div>

            <div className="grid md:grid-cols-3 gap-4">
                <Select
                    label="Blood Group"
                    value={filters.bloodGroup}
                    onChange={(e) => {
                        setFilters(prev => ({ ...prev, bloodGroup: e.target.value }));
                        fetchRequests();
                    }}
                    options={[
                        { value: 'all', label: 'All Blood Groups' },
                        { value: 'A+', label: 'A+' },
                        { value: 'A-', label: 'A-' },
                        { value: 'B+', label: 'B+' },
                        { value: 'B-', label: 'B-' },
                        { value: 'AB+', label: 'AB+' },
                        { value: 'AB-', label: 'AB-' },
                        { value: 'O+', label: 'O+' },
                        { value: 'O-', label: 'O-' },
                    ]}
                />
                <Select
                    label="Urgency"
                    value={filters.urgency}
                    onChange={(e) => {
                        setFilters(prev => ({ ...prev, urgency: e.target.value }));
                        fetchRequests();
                    }}
                    options={[
                        { value: 'all', label: 'All Urgency Levels' },
                        { value: 'High', label: 'High' },
                        { value: 'Medium', label: 'Medium' },
                        { value: 'Low', label: 'Low' },
                    ]}
                />
                <Input
                    label="Location"
                    placeholder="Enter city or zip code"
                    value={filters.location}
                    onChange={(e) => setFilters(prev => ({ ...prev, location: e.target.value }))}
                />
            </div>

            {error && (
                <Alert variant="error" onClose={() => setError('')}>
                    {error}
                </Alert>
            )}

            {loading ? (
                <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading requests...</p>
                </div>
            ) : requests.length === 0 ? (
                <div className="text-center py-8">
                    <p className="text-gray-600">No blood requests found</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {requests.map(request => (
                        <BloodRequestCard
                            key={request.id}
                            request={request}
                            onRespond={() => handleRespond(request.id)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
