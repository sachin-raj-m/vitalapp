"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Loader2, Check, X, FileText, ExternalLink, Users, Activity, Shield, Search, Trash2, HeartPulse } from 'lucide-react';
import { motion } from 'framer-motion';

interface Profile {
    id: string;
    full_name: string;
    email: string;
    role: string;
    is_donor: boolean;
    verification_status: string;
    created_at: string;
    blood_group?: string;
    blood_group_proof_url?: string;
}

interface Request {
    id: string;
    hospital_name: string;
    blood_group: string;
    units_needed: number;
    urgency_level: string;
    status: string;
    created_at: string;
    contact_name: string;
}

export default function AdminDashboard() {
    const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'verifications' | 'requests'>('overview');
    const [stats, setStats] = useState({ users: 0, donors: 0, pending: 0, requests: 0 });
    const [users, setUsers] = useState<Profile[]>([]);
    const [requests, setRequests] = useState<Request[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchAllData();
    }, []);

    const fetchAllData = async () => {
        setLoading(true);
        try {
            // Parallel fetches for efficiency
            const [usersRes, requestsRes] = await Promise.all([
                supabase.from('profiles').select('*').order('created_at', { ascending: false }),
                supabase.from('blood_requests').select('*').order('created_at', { ascending: false })
            ]);

            if (usersRes.error) throw usersRes.error;
            if (requestsRes.error) throw requestsRes.error;

            const allUsers = usersRes.data || [];
            const allRequests = requestsRes.data || [];

            setUsers(allUsers);
            setRequests(allRequests);

            setStats({
                users: allUsers.length,
                donors: allUsers.filter(u => u.is_donor).length,
                pending: allUsers.filter(u => u.verification_status === 'pending' && u.is_donor).length,
                requests: allRequests.filter(r => r.status === 'active').length
            });
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyInList = async (userId: string, status: 'verified' | 'rejected') => {
        setActionLoading(userId);
        try {
            const { error } = await supabase.from('profiles').update({ verification_status: status }).eq('id', userId);
            if (error) throw error;

            // Optimistic update
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, verification_status: status } : u));
            setStats(prev => ({ ...prev, pending: prev.pending - 1 }));
        } catch (err: any) {
            setError(err.message);
        } finally {
            setActionLoading(null);
        }
    };

    const toggleRole = async (userId: string, currentRole: string) => {
        if (!confirm(`Are you sure you want to change this user's role?`)) return;

        setActionLoading(userId);
        const newRole = currentRole === 'admin' ? 'user' : 'admin';
        try {
            const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
            if (error) throw error;
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
        } catch (err: any) {
            setError(err.message);
        } finally {
            setActionLoading(null);
        }
    };

    const deleteRequest = async (requestId: string) => {
        if (!confirm("Delete this request permanently?")) return;
        setActionLoading(requestId);
        try {
            const { error } = await supabase.from('blood_requests').delete().eq('id', requestId);
            if (error) throw error;
            setRequests(prev => prev.filter(r => r.id !== requestId));
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

    const filteredUsers = users.filter(u =>
        u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const pendingDonors = users.filter(u => u.verification_status === 'pending' && u.is_donor);

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-red-500" /></div>;

    return (
        <div className="space-y-8">
            {error && <Alert variant="error" onClose={() => setError('')}>{error}</Alert>}

            {/* Stats Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-blue-50 border-blue-100">
                    <CardBody className="p-4 flex items-center space-x-4">
                        <div className="p-3 bg-blue-100 rounded-full text-blue-600"><Users size={24} /></div>
                        <div>
                            <div className="text-2xl font-bold">{stats.users}</div>
                            <div className="text-sm text-gray-500">Total Users</div>
                        </div>
                    </CardBody>
                </Card>
                <Card className="bg-red-50 border-red-100">
                    <CardBody className="p-4 flex items-center space-x-4">
                        <div className="p-3 bg-red-100 rounded-full text-red-600"><HeartPulse size={24} /></div>
                        <div>
                            <div className="text-2xl font-bold">{stats.donors}</div>
                            <div className="text-sm text-gray-500">Donors</div>
                        </div>
                    </CardBody>
                </Card>
                <Card className="bg-orange-50 border-orange-100">
                    <CardBody className="p-4 flex items-center space-x-4">
                        <div className="p-3 bg-orange-100 rounded-full text-orange-600"><Shield size={24} /></div>
                        <div>
                            <div className="text-2xl font-bold">{stats.pending}</div>
                            <div className="text-sm text-gray-500">Pending Verify</div>
                        </div>
                    </CardBody>
                </Card>
                <Card className="bg-green-50 border-green-100">
                    <CardBody className="p-4 flex items-center space-x-4">
                        <div className="p-3 bg-green-100 rounded-full text-green-600"><Activity size={24} /></div>
                        <div>
                            <div className="text-2xl font-bold">{stats.requests}</div>
                            <div className="text-sm text-gray-500">Active Requests</div>
                        </div>
                    </CardBody>
                </Card>
            </div>

            {/* Tabs */}
            <div className="flex space-x-1 border-b overflow-x-auto pb-1">
                {['overview', 'users', 'verifications', 'requests'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        className={`px-4 py-2 capitalize font-medium text-sm transition-colors relative ${activeTab === tab ? 'text-red-600' : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        {tab}
                        {activeTab === tab && (
                            <motion.div layoutId="underline" className="absolute left-0 right-0 bottom-[-5px] h-0.5 bg-red-600" />
                        )}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="min-h-[400px]">
                {activeTab === 'overview' && (
                    <div className="space-y-6">
                        <h3 className="text-lg font-semibold">Activity Stream</h3>
                        <p className="text-gray-500">Recent application activity will appear here.</p>
                        {/* Placeholder for activity log */}
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 text-center text-sm text-gray-400">
                            System is running normally. No critical alerts.
                        </div>
                    </div>
                )}

                {activeTab === 'users' && (
                    <div className="space-y-4">
                        <div className="flex items-center space-x-2 bg-white border border-gray-300 rounded-md px-3 py-2 w-full max-w-sm">
                            <Search className="h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search users by name or email..."
                                className="outline-none text-sm w-full"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="overflow-x-auto border rounded-lg">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {filteredUsers.map(user => (
                                        <tr key={user.id}>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-medium text-gray-900">{user.full_name || 'Unknown'}</div>
                                                <div className="text-sm text-gray-500">{user.email}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}`}>
                                                    {user.role || 'user'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {user.is_donor ? (
                                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.verification_status === 'verified' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                        {user.verification_status === 'verified' ? 'Verified Donor' : 'Pending Verified'}
                                                    </span>
                                                ) : <span className="text-gray-400 text-xs">Recipient</span>}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="text-blue-600 hover:text-blue-900"
                                                    isLoading={actionLoading === user.id}
                                                    onClick={() => toggleRole(user.id, user.role || 'user')}
                                                >
                                                    {user.role === 'admin' ? 'Demote to User' : 'Promote to Admin'}
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'verifications' && (
                    <div className="space-y-4">
                        {pendingDonors.length === 0 ? (
                            <div className="text-center py-10 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                                No pending verifications. All caught up!
                            </div>
                        ) : (
                            pendingDonors.map(donor => (
                                <Card key={donor.id}>
                                    <CardBody className="flex flex-col md:flex-row justify-between items-center gap-4">
                                        <div>
                                            <h4 className="font-bold">{donor.full_name}</h4>
                                            <p className="text-sm text-gray-500">Blood Group: <span className="font-bold text-red-600">{donor.blood_group}</span></p>
                                        </div>
                                        <div className="flex gap-2">
                                            {donor.blood_group_proof_url && (
                                                <a href={getProofUrl(donor.blood_group_proof_url)} target="_blank" className="flex items-center text-blue-600 text-sm hover:underline px-3">
                                                    View Proof <ExternalLink className="ml-1 w-3 h-3" />
                                                </a>
                                            )}
                                            <Button variant="secondary" size="sm" onClick={() => handleVerifyInList(donor.id, 'rejected')} isLoading={actionLoading === donor.id}>Reject</Button>
                                            <Button variant="success" size="sm" onClick={() => handleVerifyInList(donor.id, 'verified')} isLoading={actionLoading === donor.id}>Approve</Button>
                                        </div>
                                    </CardBody>
                                </Card>
                            ))
                        )}
                    </div>
                )}

                {activeTab === 'requests' && (
                    <div className="overflow-x-auto border rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hospital</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Blood Group</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {requests.map(req => (
                                    <tr key={req.id}>
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{req.hospital_name}</td>
                                        <td className="px-6 py-4 text-sm text-gray-900">{req.blood_group} ({req.units_needed} units) <span className="text-xs text-red-500 border border-red-200 px-1 rounded">{req.urgency_level}</span></td>
                                        <td className="px-6 py-4 text-sm">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${req.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                                {req.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">{new Date(req.created_at).toLocaleDateString()}</td>
                                        <td className="px-6 py-4 text-sm">
                                            <button onClick={() => deleteRequest(req.id)} className="text-red-500 hover:text-red-700">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
