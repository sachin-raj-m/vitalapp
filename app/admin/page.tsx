"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Loader2, Check, X, FileText, ExternalLink } from 'lucide-react';

interface PendingDonor {
    id: string;
    full_name: string;
    email: string;
    blood_group: string;
    blood_group_proof_url: string;
    created_at: string;
}

export default function AdminDashboard() {
    const [donors, setDonors] = useState<PendingDonor[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchPendingDonors();
    }, []);

    const fetchPendingDonors = async () => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('verification_status', 'pending')
                .eq('is_donor', true)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setDonors(data || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async (userId: string, status: 'verified' | 'rejected') => {
        setActionLoading(userId);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ verification_status: status })
                .eq('id', userId);

            if (error) throw error;

            // Remove from list
            setDonors(prev => prev.filter(d => d.id !== userId));
        } catch (err: any) {
            setError(err.message);
        } finally {
            setActionLoading(null);
        }
    };

    const getProofUrl = (path: string) => {
        if (!path) return '';
        const { data } = supabase.storage.from('proofs').getPublicUrl(path);
        return data.publicUrl;
    };

    if (loading) {
        return (
            <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-semibold">Pending Verifications ({donors.length})</h2>

            {error && <Alert variant="error">{error}</Alert>}

            {donors.length === 0 ? (
                <Card>
                    <CardBody className="text-center py-8 text-gray-500">
                        No pending verifications found.
                    </CardBody>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {donors.map(donor => (
                        <Card key={donor.id}>
                            <CardBody className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div>
                                    <h3 className="font-semibold text-lg">{donor.full_name}</h3>
                                    <p className="text-sm text-gray-600">{donor.email}</p>
                                    <div className="mt-2 flex items-center space-x-4">
                                        <span className="bg-primary-100 text-primary-800 text-xs px-2 py-1 rounded-full font-medium">
                                            {donor.blood_group}
                                        </span>
                                        <span className="text-xs text-gray-500">
                                            Submitted: {new Date(donor.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 w-full md:w-auto">
                                    {donor.blood_group_proof_url && (
                                        <a
                                            href={getProofUrl(donor.blood_group_proof_url)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center text-blue-600 hover:text-blue-800 text-sm mr-4"
                                        >
                                            <FileText className="h-4 w-4 mr-1" />
                                            View Proof
                                            <ExternalLink className="h-3 w-3 ml-1" />
                                        </a>
                                    )}

                                    <Button
                                        variant="secondary"
                                        onClick={() => handleVerify(donor.id, 'rejected')}
                                        isLoading={actionLoading === donor.id}
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                        leftIcon={<X className="h-4 w-4" />}
                                    >
                                        Reject
                                    </Button>
                                    <Button
                                        variant="primary"
                                        onClick={() => handleVerify(donor.id, 'verified')}
                                        isLoading={actionLoading === donor.id}
                                        leftIcon={<Check className="h-4 w-4" />}
                                    >
                                        Approve
                                    </Button>
                                </div>
                            </CardBody>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
