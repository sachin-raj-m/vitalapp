"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Download, Loader2, Check, X, FileText, ExternalLink, Users, Activity, Shield, Search, Trash2, HeartPulse, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { AnalyticsCharts } from '@/components/admin/AnalyticsCharts';

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
    phone?: string;
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
    const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'verifications' | 'requests' | 'analytics'>('overview');
    const [stats, setStats] = useState({ users: 0, donors: 0, pending: 0, requests: 0 });
    const [users, setUsers] = useState<Profile[]>([]);
    const [requests, setRequests] = useState<Request[]>([]);
    const [donations, setDonations] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUser, setSelectedUser] = useState<Profile | null>(null);

    useEffect(() => {
        fetchAllData();
    }, []);

    const fetchAllData = async () => {
        setIsLoading(true);
        try {
            // Parallel fetches for efficiency
            const [usersRes, requestsRes, donationsRes] = await Promise.all([
                supabase.from('profiles').select('*').order('created_at', { ascending: false }),
                supabase.from('blood_requests').select('*').order('created_at', { ascending: false }),
                supabase.from('donations').select('*').order('created_at', { ascending: true })
            ]);

            if (usersRes.error) throw usersRes.error;
            if (requestsRes.error) throw requestsRes.error;
            if (donationsRes.error) throw donationsRes.error;

            const allUsers = usersRes.data || [];
            const allRequests = requestsRes.data || [];
            const allDonations = donationsRes.data || [];

            setUsers(allUsers);
            setRequests(allRequests);
            setDonations(allDonations);

            setStats({
                users: allUsers.length,
                donors: allUsers.filter(u => u.is_donor).length,
                pending: allUsers.filter(u => u.verification_status === 'pending' && u.is_donor).length,
                requests: allRequests.filter(r => r.status === 'active').length
            });
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
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
            // Fetch all data again to ensure consistency after deletion
            const [profilesRes, requestsRes, donationsRes] = await Promise.all([
                supabase.from('profiles').select('*').order('created_at', { ascending: false }),
                supabase.from('blood_requests').select('*').order('created_at', { ascending: false }),
                supabase.from('donations').select('*').order('created_at', { ascending: false }) // Changed to false for consistency with other fetches
            ]);

            if (profilesRes.error) console.error('Error fetching profiles', profilesRes.error);
            if (requestsRes.error) console.error('Error fetching requests', requestsRes.error);
            if (donationsRes.error) console.error('Error fetching donations', donationsRes.error);

            setUsers(profilesRes.data || []);
            setRequests(requestsRes.data || []);
            setDonations(donationsRes.data || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setActionLoading(null); // Reverted to original setActionLoading(null)
        }
    };

    const handleUpdateUser = async () => {
        if (!selectedUser) return;
        setActionLoading('update_user');
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    full_name: selectedUser.full_name,
                    phone: selectedUser.phone,
                    blood_group: selectedUser.blood_group,
                    is_donor: selectedUser.is_donor,
                    verification_status: selectedUser.verification_status,
                    role: selectedUser.role
                })
                .eq('id', selectedUser.id);

            if (error) throw error;

            // Update local state
            setUsers(prev => prev.map(u => u.id === selectedUser.id ? selectedUser : u));
            setSelectedUser(null);
            alert('User details updated successfully!');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setActionLoading(null);
        }
    };

    const handleViewProof = async (path: string) => {
        if (!path) return;
        try {
            const { data, error } = await supabase.storage.from('proofs').createSignedUrl(path, 60);
            if (error) throw error;
            if (data?.signedUrl) {
                window.open(data.signedUrl, '_blank');
            }
        } catch (err: any) {
            console.error('Error generating signed URL');
            alert('Could not access document. Please ensure you are an admin.');
        }
    };

    const filteredUsers = users.filter(u =>
        u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const pendingDonors = users.filter(u => u.verification_status === 'pending' && u.is_donor);

    const downloadCSV = (data: any[], filename: string) => {
        if (!data.length) return;
        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(','),
            ...data.map(row => headers.map(fieldName => JSON.stringify(row[fieldName] || '')).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-red-500" /></div>;

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
                {['overview', 'users', 'verifications', 'requests', 'analytics'].map((tab) => (
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
                        <div className="space-y-4">
                            {[...users, ...requests]
                                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                                .slice(0, 10)
                                .map((item: any, i) => {
                                    const isUser = 'full_name' in item;
                                    return (
                                        <div key={i} className="flex items-start space-x-3 p-3 bg-white rounded-lg border border-gray-100 hover:shadow-sm transition-shadow">
                                            <div className={`p-2 rounded-full ${isUser ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600'}`}>
                                                {isUser ? <User size={16} /> : <Activity size={16} />}
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-900">
                                                    {isUser ? (
                                                        <span>New user <span className="font-semibold">{item.full_name}</span> joined the platform.</span>
                                                    ) : (
                                                        <span>New blood request for <span className="font-semibold">{item.blood_group}</span> at {item.hospital_name}.</span>
                                                    )}
                                                </p>
                                                <p className="text-xs text-gray-500 mt-1">
                                                    {new Date(item.created_at).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}

                            {users.length === 0 && requests.length === 0 && (
                                <div className="text-center py-8 text-gray-500">
                                    No activity recorded yet.
                                </div>
                            )}
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
                        <div className="flex justify-end mb-4">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => downloadCSV(filteredUsers, 'users_export.csv')}
                                className="flex items-center gap-2"
                            >
                                <Download size={16} /> Export CSV
                            </Button>
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
                                            <button
                                                onClick={() => setSelectedUser(donor)}
                                                className="font-bold text-lg hover:text-red-600 transition-colors text-left"
                                            >
                                                {donor.full_name}
                                            </button>
                                            <div className="text-sm text-gray-500 space-y-1">
                                                <p>{donor.email}</p>
                                                <p>Blood Group: <span className="font-bold text-red-600">{donor.blood_group}</span></p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            {donor.blood_group_proof_url && (
                                                <button
                                                    onClick={() => handleViewProof(donor.blood_group_proof_url!)}
                                                    className="flex items-center text-blue-600 text-sm hover:underline px-3"
                                                >
                                                    View Proof <ExternalLink className="ml-1 w-3 h-3" />
                                                </button>
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
                    <div className="space-y-4">
                        <div className="flex justify-end">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => downloadCSV(requests, 'requests_export.csv')}
                                className="flex items-center gap-2"
                            >
                                <Download size={16} /> Export CSV
                            </Button>
                        </div>
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
                    </div>
                )}

                {activeTab === 'analytics' && (
                    <AnalyticsCharts users={users} requests={requests} donations={donations} />
                )}
            </div>

            {/* Edit User Modal */}
            {selectedUser && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
                    >
                        <div className="p-6 border-b flex justify-between items-center sticky top-0 bg-white z-10">
                            <h3 className="text-xl font-bold">Edit User Details</h3>
                            <button onClick={() => setSelectedUser(null)} className="text-gray-400 hover:text-gray-600">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                                <input
                                    type="text"
                                    value={selectedUser.full_name || ''}
                                    onChange={(e) => setSelectedUser({ ...selectedUser, full_name: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                <input
                                    type="email"
                                    value={selectedUser.email || ''}
                                    disabled
                                    className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                                <input
                                    type="tel"
                                    value={selectedUser.phone || ''}
                                    onChange={(e) => setSelectedUser({ ...selectedUser, phone: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Blood Group</label>
                                <select
                                    value={selectedUser.blood_group || ''}
                                    onChange={(e) => setSelectedUser({ ...selectedUser, blood_group: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                                >
                                    <option value="">Select Group</option>
                                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                                        <option key={bg} value={bg}>{bg}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Verification Status</label>
                                    <select
                                        value={selectedUser.verification_status || 'pending'}
                                        onChange={(e) => setSelectedUser({ ...selectedUser, verification_status: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                                    >
                                        <option value="pending">Pending</option>
                                        <option value="verified">Verified</option>
                                        <option value="rejected">Rejected</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                                    <select
                                        value={selectedUser.role || 'user'}
                                        onChange={(e) => setSelectedUser({ ...selectedUser, role: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                                    >
                                        <option value="user">User</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex items-center space-x-2 pt-2">
                                <input
                                    type="checkbox"
                                    id="is_donor"
                                    checked={selectedUser.is_donor || false}
                                    onChange={(e) => setSelectedUser({ ...selectedUser, is_donor: e.target.checked })}
                                    className="rounded text-red-600 focus:ring-red-500"
                                />
                                <label htmlFor="is_donor" className="text-sm font-medium text-gray-700">Registered as Donor</label>
                            </div>

                        </div>
                        <div className="p-6 border-t bg-gray-50 flex justify-end space-x-3 rounded-b-xl">
                            <Button variant="ghost" onClick={() => setSelectedUser(null)}>Cancel</Button>
                            <Button
                                variant="primary"
                                onClick={handleUpdateUser}
                                isLoading={actionLoading === 'update_user'}
                            >
                                Save Changes
                            </Button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
