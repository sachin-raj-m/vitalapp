"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Loader2, User, MapPin, Phone, Mail, Droplet, Award, Calendar, Settings, LogOut } from 'lucide-react';
import type { BloodGroup } from '@/types';

interface Profile {
    id: string;
    email: string;
    full_name: string;
    phone: string;
    blood_group: BloodGroup;
    blood_group_proof_type: string;
    blood_group_proof_url: string;
    is_donor: boolean;
    is_available: boolean;
    location: {
        latitude: number;
        longitude: number;
        address: string;
    };
    created_at: string;
}

interface Stats {
    total_donations: number;
    total_requests: number;
    last_donation_date: string | null;
    achievements: string[];
}

export default function ProfilePage() {
    const router = useRouter();
    const { user, signOut } = useAuth();
    const [profile, setProfile] = useState<Profile | null>(null);
    const [stats, setStats] = useState<Stats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({
        full_name: '',
        phone: '',
        is_available: false,
        address: ''
    });

    useEffect(() => {
        loadProfile();
        loadStats();
    }, []);

    const loadProfile = async () => {
        try {
            if (!user) return;

            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (error) throw error;
            setProfile(data);
            setEditForm({
                full_name: data.full_name,
                phone: data.phone,
                is_available: data.is_available,
                address: data.location.address
            });
        } catch (err: any) {
            console.error('Error loading profile:', err);
            setError('Failed to load profile data');
        }
    };

    const loadStats = async () => {
        try {
            if (!user) return;

            // Load donations count
            const { data: donations, error: donationsError } = await supabase
                .from('donations')
                .select('created_at', { count: 'exact' })
                .eq('donor_id', user.id);

            if (donationsError) throw donationsError;

            // Load requests count
            const { data: requests, error: requestsError } = await supabase
                .from('requests')
                .select('created_at', { count: 'exact' })
                .eq('requester_id', user.id);

            if (requestsError) throw requestsError;

            // Get last donation date
            const lastDonation = donations?.sort((a, b) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )[0];

            // Calculate achievements
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
            console.error('Error loading stats:', err);
            setError('Failed to load statistics');
        } finally {
            setIsLoading(false);
        }
    };

    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    full_name: editForm.full_name,
                    phone: editForm.phone,
                    is_available: editForm.is_available,
                    location: {
                        ...profile?.location,
                        address: editForm.address
                    }
                })
                .eq('id', user?.id);

            if (error) throw error;

            await loadProfile();
            setIsEditing(false);
        } catch (err: any) {
            console.error('Error updating profile:', err);
            setError('Failed to update profile');
        }
    };

    const handleSignOut = async () => {
        try {
            await signOut();
            router.push('/login');
        } catch (err) {
            console.error('Error signing out:', err);
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
        <div className="max-w-4xl mx-auto space-y-6">
            {error && (
                <Alert variant="error" className="mb-4">
                    {error}
                </Alert>
            )}

            {/* Profile Header */}
            <Card>
                <CardBody className="relative">
                    {!isEditing && (
                        <Button
                            variant="ghost"
                            className="absolute top-4 right-4"
                            onClick={() => setIsEditing(true)}
                        >
                            <Settings className="h-5 w-5" />
                        </Button>
                    )}
                    <div className="flex items-center space-x-4">
                        <div className="h-20 w-20 rounded-full bg-primary-100 flex items-center justify-center">
                            <User className="h-10 w-10 text-primary-500" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">
                                {profile?.full_name}
                            </h1>
                            <div className="flex items-center space-x-4 text-gray-600 mt-2">
                                <div className="flex items-center">
                                    <Droplet className="h-4 w-4 mr-1" />
                                    {profile?.blood_group}
                                </div>
                                <div className="flex items-center">
                                    <MapPin className="h-4 w-4 mr-1" />
                                    {profile?.location.address || 'No address set'}
                                </div>
                            </div>
                        </div>
                    </div>
                </CardBody>
            </Card>

            {/* Edit Form */}
            {isEditing && (
                <Card>
                    <CardHeader>
                        <h2 className="text-xl font-semibold">Edit Profile</h2>
                    </CardHeader>
                    <CardBody>
                        <form onSubmit={handleEdit} className="space-y-4">
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
                            <Input
                                label="Address"
                                value={editForm.address}
                                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                                required
                            />
                            <div className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id="is_available"
                                    checked={editForm.is_available}
                                    onChange={(e) => setEditForm({ ...editForm, is_available: e.target.checked })}
                                    className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                                />
                                <label htmlFor="is_available" className="text-sm text-gray-700">
                                    Available for donation
                                </label>
                            </div>
                            <div className="flex space-x-4">
                                <Button type="submit" variant="primary">
                                    Save Changes
                                </Button>
                                <Button type="button" variant="secondary" onClick={() => setIsEditing(false)}>
                                    Cancel
                                </Button>
                            </div>
                        </form>
                    </CardBody>
                </Card>
            )}

            {/* Contact Information */}
            <Card>
                <CardHeader>
                    <h2 className="text-xl font-semibold">Contact Information</h2>
                </CardHeader>
                <CardBody>
                    <div className="space-y-4">
                        <div className="flex items-center">
                            <Mail className="h-5 w-5 text-gray-400 mr-2" />
                            <span>{profile?.email}</span>
                        </div>
                        <div className="flex items-center">
                            <Phone className="h-5 w-5 text-gray-400 mr-2" />
                            <span>{profile?.phone}</span>
                        </div>
                    </div>
                </CardBody>
            </Card>

            {/* Statistics */}
            <Card>
                <CardHeader>
                    <h2 className="text-xl font-semibold">Statistics</h2>
                </CardHeader>
                <CardBody>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="text-center p-4 bg-gray-50 rounded-lg">
                            <Droplet className="h-8 w-8 text-primary-500 mx-auto mb-2" />
                            <div className="text-2xl font-bold text-gray-900">{stats?.total_donations}</div>
                            <div className="text-sm text-gray-600">Total Donations</div>
                        </div>
                        <div className="text-center p-4 bg-gray-50 rounded-lg">
                            <Calendar className="h-8 w-8 text-primary-500 mx-auto mb-2" />
                            <div className="text-2xl font-bold text-gray-900">
                                {stats?.last_donation_date
                                    ? new Date(stats.last_donation_date).toLocaleDateString()
                                    : 'Never'}
                            </div>
                            <div className="text-sm text-gray-600">Last Donation</div>
                        </div>
                        <div className="text-center p-4 bg-gray-50 rounded-lg">
                            <Award className="h-8 w-8 text-primary-500 mx-auto mb-2" />
                            <div className="text-2xl font-bold text-gray-900">{stats?.achievements.length}</div>
                            <div className="text-sm text-gray-600">Achievements</div>
                        </div>
                    </div>
                </CardBody>
            </Card>

            {/* Achievements */}
            {stats?.achievements.length ? (
                <Card>
                    <CardHeader>
                        <h2 className="text-xl font-semibold">Achievements</h2>
                    </CardHeader>
                    <CardBody>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {stats.achievements.map((achievement, index) => (
                                <div key={index} className="text-center p-4 bg-gray-50 rounded-lg">
                                    <Award className="h-6 w-6 text-primary-500 mx-auto mb-2" />
                                    <div className="text-sm font-medium text-gray-900">{achievement}</div>
                                </div>
                            ))}
                        </div>
                    </CardBody>
                </Card>
            ) : null}

            {/* Sign Out Button */}
            <div className="flex justify-center">
                <Button
                    variant="secondary"
                    onClick={handleSignOut}
                    className="text-red-600 hover:text-red-700"
                >
                    <LogOut className="h-5 w-5 mr-2" />
                    Sign Out
                </Button>
            </div>
        </div>
    );
}
