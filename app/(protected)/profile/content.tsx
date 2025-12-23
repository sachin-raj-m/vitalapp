"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Loader2, User, MapPin, Phone, Mail, Droplet, Award, Calendar, Settings, LogOut, Edit2, Check, X, Shield, Heart, Bell } from 'lucide-react';
import { PushNotificationManager } from '@/components/PushNotificationManager';
import type { BloodGroup } from '@/types';
import { motion } from 'framer-motion';

interface Stats {
    total_donations: number;
    total_requests: number;
    last_donation_date: string | null;
    achievements: string[];
}

export default function ProfilePage() {
    const router = useRouter();
    const { user, signOut, session, updateProfile } = useAuth();
    const [stats, setStats] = useState<Stats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({
        full_name: '',
        phone: '',
        is_available: false,
        permanent_zip: '',
        present_zip: ''
    });

    useEffect(() => {
        if (user) {
            setEditForm({
                full_name: user.full_name || '',
                phone: user.phone || '',
                is_available: user.is_available || false,
                permanent_zip: user.permanent_zip || '',
                present_zip: user.present_zip || ''
            });
            loadStats();
        }
    }, [user]);

    const loadStats = async () => {
        try {
            if (!user) return;

            const { data: donations, error: donationsError } = await supabase
                .from('donations')
                .select('created_at', { count: 'exact' })
                .eq('donor_id', user.id);

            if (donationsError) throw donationsError;

            const { data: requests, error: requestsError } = await supabase
                .from('blood_requests')
                .select('created_at', { count: 'exact' })
                .eq('user_id', user.id);

            if (requestsError) throw requestsError;

            const lastDonation = donations?.sort((a, b) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )[0];

            const achievements = [];
            if (donations?.length >= 1) achievements.push('First Time Donor');
            if (donations?.length >= 5) achievements.push('Regular Donor');
            if (donations?.length >= 10) achievements.push('Super Donor');
            if (requests?.length >= 1) achievements.push('Life Saver');

            setStats({
                total_donations: donations?.length || 0,
                total_requests: requests?.length || 0,
                last_donation_date: lastDonation?.created_at || null,
                achievements
            });
        } catch (err: any) {
            console.error('Error loading stats');
            setError('Failed to load statistics');
        } finally {
            setIsLoading(false);
        }
    };

    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        try {
            await updateProfile({
                full_name: editForm.full_name,
                phone: editForm.phone,
                is_available: editForm.is_available,
                permanent_zip: editForm.permanent_zip,
                present_zip: editForm.present_zip
            });
            setIsEditing(false);
        } catch (err: any) {
            console.error('Error updating profile');
            setError('Failed to update profile');
        }
    };

    const handleSignOut = async () => {
        try {
            await signOut();
            router.push('/login');
        } catch (err) {
            console.error('Error signing out');
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center min-h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-8">
            {error && (
                <Alert variant="error" className="mb-4">
                    {error}
                </Alert>
            )}

            {/* Hero Header with Gradient */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-500 via-red-600 to-pink-600 p-8 text-white shadow-xl"
            >
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -ml-24 -mb-24"></div>

                <div className="relative flex items-start justify-between">
                    <div className="flex items-center space-x-6">
                        <div className="relative">
                            <div className="h-24 w-24 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center ring-4 ring-white/30">
                                <User className="h-12 w-12 text-white" />
                            </div>
                            {user?.is_donor && (
                                <div className="absolute -bottom-2 -right-2 bg-white rounded-full p-2 shadow-lg">
                                    <Droplet className="h-4 w-4 text-red-500" />
                                </div>
                            )}
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold mb-2">{user?.full_name}</h1>
                            <div className="flex items-center space-x-4 text-white/90">
                                <div className="flex items-center space-x-2">
                                    <Droplet className="h-4 w-4" />
                                    <span className="font-semibold">{user?.blood_group || 'N/A'}</span>
                                </div>
                                {user?.is_donor && (
                                    <div className="flex items-center space-x-2 bg-white/20 px-3 py-1 rounded-full">
                                        <Heart className="h-4 w-4" />
                                        <span className="text-sm font-medium">Active Donor</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <Button
                        variant="ghost"
                        onClick={() => setIsEditing(!isEditing)}
                        className="text-white hover:bg-white/20 border border-white/30"
                    >
                        {isEditing ? (
                            <>
                                <X className="h-4 w-4 mr-2" />
                                Cancel
                            </>
                        ) : (
                            <>
                                <Edit2 className="h-4 w-4 mr-2" />
                                Edit Profile
                            </>
                        )}
                    </Button>
                </div>
            </motion.div>

            {/* Stats Grid */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-6"
            >
                <Card className="hover:shadow-lg transition-shadow">
                    <CardBody className="text-center p-6">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mb-4">
                            <Droplet className="h-6 w-6 text-red-600" />
                        </div>
                        <div className="text-3xl font-bold text-gray-900 mb-1">{stats?.total_donations || 0}</div>
                        <div className="text-sm text-gray-600">Total Donations</div>
                    </CardBody>
                </Card>

                <Card className="hover:shadow-lg transition-shadow">
                    <CardBody className="text-center p-6">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 mb-4">
                            <Calendar className="h-6 w-6 text-blue-600" />
                        </div>
                        <div className="text-3xl font-bold text-gray-900 mb-1">
                            {stats?.last_donation_date
                                ? new Date(stats.last_donation_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                : 'Never'}
                        </div>
                        <div className="text-sm text-gray-600">Last Donation</div>
                    </CardBody>
                </Card>

                <Card className="hover:shadow-lg transition-shadow">
                    <CardBody className="text-center p-6">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 mb-4">
                            <Award className="h-6 w-6 text-amber-600" />
                        </div>
                        <div className="text-3xl font-bold text-gray-900 mb-1">{stats?.achievements.length || 0}</div>
                        <div className="text-sm text-gray-600">Achievements</div>
                    </CardBody>
                </Card>
            </motion.div>

            {/* Edit Form */}
            {isEditing && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                >
                    <Card>
                        <CardHeader>
                            <h2 className="text-xl font-semibold">Edit Profile Information</h2>
                        </CardHeader>
                        <CardBody>
                            <form onSubmit={handleEdit} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <Input
                                        label="Full Name"
                                        value={editForm.full_name}
                                        onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                                        required
                                    />
                                    <Input
                                        label="Phone"
                                        value={editForm.phone}
                                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <Input
                                        label="Permanent Zip Code"
                                        value={editForm.permanent_zip}
                                        onChange={(e) => setEditForm({ ...editForm, permanent_zip: e.target.value })}
                                        required
                                        placeholder="e.g. 560001"
                                    />
                                    <Input
                                        label="Present Zip Code"
                                        value={editForm.present_zip}
                                        onChange={(e) => setEditForm({ ...editForm, present_zip: e.target.value })}
                                        required
                                        placeholder="e.g. 560001"
                                    />
                                </div>

                                <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
                                    <input
                                        type="checkbox"
                                        id="is_available"
                                        checked={editForm.is_available}
                                        onChange={(e) => setEditForm({ ...editForm, is_available: e.target.checked })}
                                        className="w-5 h-5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                                    />
                                    <label htmlFor="is_available" className="text-sm font-medium text-gray-700 cursor-pointer">
                                        I am available for blood donation
                                    </label>
                                </div>

                                <div className="flex space-x-4">
                                    <Button type="submit" variant="primary" className="flex-1">
                                        <Check className="h-4 w-4 mr-2" />
                                        Save Changes
                                    </Button>
                                    <Button type="button" variant="secondary" onClick={() => setIsEditing(false)}>
                                        Cancel
                                    </Button>
                                </div>
                            </form>
                        </CardBody>
                    </Card>
                </motion.div>
            )}

            {/* Preferences */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
            >
                <Card>
                    <CardHeader>
                        <h2 className="text-xl font-semibold">Preferences</h2>
                    </CardHeader>
                    <CardBody>
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                            <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                                    <Bell className="h-5 w-5 text-indigo-600" />
                                </div>
                                <div>
                                    <div className="font-medium text-gray-900">Push Notifications</div>
                                    <div className="text-sm text-gray-500">Receive alerts when blood is needed nearby</div>
                                </div>
                            </div>
                            <PushNotificationManager />
                        </div>
                    </CardBody>
                </Card>
            </motion.div>

            {/* Contact Information */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
            >
                <Card>
                    <CardHeader>
                        <h2 className="text-xl font-semibold">Contact Information</h2>
                    </CardHeader>
                    <CardBody>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                <div className="flex items-center space-x-3">
                                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                                        <Mail className="h-5 w-5 text-blue-600" />
                                    </div>
                                    <div>
                                        <div className="text-sm text-gray-500">Email</div>
                                        <div className="font-medium">{user?.email}</div>
                                    </div>
                                </div>
                                {session?.user && !session.user.email_confirmed_at && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={async () => {
                                            try {
                                                const { error } = await supabase.auth.resend({
                                                    type: 'signup',
                                                    email: session.user.email!,
                                                    options: {
                                                        emailRedirectTo: `${window.location.origin}/dashboard`
                                                    }
                                                });
                                                if (error) throw error;
                                                alert('Verification email sent!');
                                            } catch (err: any) {
                                                console.error('Verification error');
                                                alert('Failed to send verification email');
                                            }
                                        }}
                                    >
                                        Verify Email
                                    </Button>
                                )}
                            </div>

                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                <div className="flex items-center space-x-3">
                                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                                        <Phone className="h-5 w-5 text-green-600" />
                                    </div>
                                    <div>
                                        <div className="text-sm text-gray-500">Phone</div>
                                        <div className="font-medium">{user?.phone || 'Not provided'}</div>
                                    </div>
                                </div>
                                {session?.user && (!session.user.phone_confirmed_at && user?.phone) && (
                                    <span className="text-xs text-amber-600 bg-amber-100 px-3 py-1 rounded-full font-medium">
                                        Unverified
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center p-4 bg-gray-50 rounded-lg">
                                <div className="flex items-center space-x-3">
                                    <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                                        <MapPin className="h-5 w-5 text-purple-600" />
                                    </div>
                                    <div>
                                        <div className="text-sm text-gray-500">Location</div>
                                        <div className="font-medium">
                                            {user?.permanent_zip && user?.present_zip
                                                ? `${user.permanent_zip} (Permanent) • ${user.present_zip} (Present)`
                                                : 'Not provided'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardBody>
                </Card>
            </motion.div>

            {/* Achievements */}
            {stats?.achievements && stats.achievements.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    <Card>
                        <CardHeader>
                            <h2 className="text-xl font-semibold">Achievements</h2>
                        </CardHeader>
                        <CardBody>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {stats.achievements.map((achievement, index) => (
                                    <motion.div
                                        key={index}
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: 0.4 + index * 0.1 }}
                                        className="text-center p-6 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200 hover:shadow-md transition-shadow"
                                    >
                                        <Award className="h-8 w-8 text-amber-600 mx-auto mb-3" />
                                        <div className="text-sm font-semibold text-gray-900">{achievement}</div>
                                    </motion.div>
                                ))}
                            </div>
                        </CardBody>
                    </Card>
                </motion.div>
            )}

            {/* Sign Out Button */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="flex flex-col items-center pt-8 space-y-4"
            >
                <div className="w-full max-w-2xl border-t border-gray-200 pt-8">
                    <div className="rounded-lg border border-red-100 bg-red-50 p-6">
                        <h3 className="text-lg font-medium text-red-800 mb-2 flex items-center">
                            <Shield className="h-5 w-5 mr-2" />
                            Danger Zone
                        </h3>
                        <p className="text-sm text-red-600 mb-4">
                            Deleting your account is permanent. All your data including donation history and personal details will be wiped immediately.
                        </p>
                        <Button
                            variant="primary"
                            className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto"
                            onClick={async () => {
                                if (confirm('Are you ABSOLUTELY sure? This action cannot be undone.')) {
                                    try {
                                        const res = await fetch('/api/auth/delete', { method: 'POST' });
                                        if (!res.ok) throw new Error('Deletion failed');
                                        await signOut();
                                        router.push('/login');
                                    } catch (e) {
                                        alert('Failed to delete account. Please try again.');
                                    }
                                }
                            }}
                        >
                            <User className="h-4 w-4 mr-2" />
                            Delete My Account
                        </Button>
                    </div>
                </div>

                <Button
                    variant="secondary"
                    onClick={handleSignOut}
                    className="text-gray-600 hover:text-gray-900"
                >
                    <LogOut className="h-5 w-5 mr-2" />
                    Sign Out
                </Button>
            </motion.div>
        </div>
    );
}
