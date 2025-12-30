"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Check, Lock } from 'lucide-react';
import { SecuritySettings } from '@/app/(protected)/profile/SecuritySettings';

export default function ProfileEditPage() {
    const router = useRouter();
    const { user, updateProfile } = useAuth();
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const [editForm, setEditForm] = useState({
        full_name: '',
        phone: '',
        is_available: false,
        permanent_zip: '',
        present_zip: '',
        is_public_profile: false
    });

    // OTP Verification State
    const [isVerifying, setIsVerifying] = useState(false);
    const [otp, setOtp] = useState('');
    const [pendingPhone, setPendingPhone] = useState('');

    useEffect(() => {
        if (user) {
            setEditForm({
                full_name: user.full_name || '',
                phone: user.phone || '',
                is_available: user.is_available || false,
                permanent_zip: user.permanent_zip || '',
                present_zip: user.present_zip || '',
                is_public_profile: user.is_public_profile || false
            });
        }
    }, [user]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setError('');
        setSuccess('');
        setIsLoading(true);

        try {


            // Check if phone number changed
            if (editForm.phone !== user?.phone) {


                // Initiate Phone Verification
                const { error: authError } = await supabase.auth.updateUser({
                    phone: editForm.phone
                });

                if (authError) {
                    console.error('OTP send error:', authError);
                    throw authError;
                }


                setPendingPhone(editForm.phone);
                setIsVerifying(true);
                setIsLoading(false);
                setSuccess(`Verification code sent to ${editForm.phone}`);
                return;
            }

            // Normal update without phone change
            await updateProfile({
                full_name: editForm.full_name,
                is_available: editForm.is_available,
                permanent_zip: editForm.permanent_zip,
                present_zip: editForm.present_zip,
                is_public_profile: editForm.is_public_profile
                // phone is not updated here directly if not changed
            });
            setSuccess('Profile updated successfully!');
            setTimeout(() => router.push('/profile'), 1500);
        } catch (err: any) {
            console.error('Error updating profile:', err);
            setError(err.message || 'Failed to update profile');
            setIsLoading(false);
        }
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setError('');
        setIsLoading(true);

        try {
            const { data, error: verifyError } = await supabase.auth.verifyOtp({
                phone: pendingPhone,
                token: otp,
                type: 'phone_change'
            });

            if (verifyError) throw verifyError;

            // Update remaining profile details
            await updateProfile({
                full_name: editForm.full_name,
                phone: pendingPhone,
                is_available: editForm.is_available,
                permanent_zip: editForm.permanent_zip,
                present_zip: editForm.present_zip,
                is_public_profile: editForm.is_public_profile
            });

            setSuccess('Phone number verified successfully!');
            setIsVerifying(false);

            // Redirect after brief delay to show success message
            setTimeout(() => router.push('/profile'), 1500);
        } catch (err: any) {
            setError(err.message || 'Invalid verification code');
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto py-8">
            <div className="mb-6 flex items-center gap-4">
                <Button
                    variant="ghost"
                    onClick={() => router.push('/profile')}
                    className="p-2 h-10 w-10 rounded-full hover:bg-slate-100"
                >
                    <ArrowLeft className="h-5 w-5 text-slate-600" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Edit Profile</h1>
                    <p className="text-slate-500 text-sm">Update your personal information</p>
                </div>
            </div>

            {error && (
                <Alert variant="error" className="mb-6">
                    {error}
                </Alert>
            )}

            {success && (
                <Alert variant="success" className="mb-6">
                    {success}
                </Alert>
            )}

            <Card className="border-slate-200 shadow-lg">
                <CardBody className="p-8">
                    <form onSubmit={handleSave} className="space-y-8">
                        {/* Personal Details */}
                        <div className="space-y-6">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Personal Details</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Input
                                    label="Full Name"
                                    value={editForm.full_name}
                                    onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                                    required
                                    className="h-11"
                                />
                                <Input
                                    label="Phone"
                                    value={editForm.phone}
                                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                                    required
                                    className="h-11"
                                />
                            </div>
                        </div>

                        <div className="h-px bg-slate-100" />

                        {/* Location */}
                        <div className="space-y-6">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Location</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Input
                                    label="Permanent Zip Code"
                                    value={editForm.permanent_zip}
                                    onChange={(e) => setEditForm({ ...editForm, permanent_zip: e.target.value })}
                                    required
                                    placeholder="e.g. 560001"
                                    className="h-11"
                                />
                                <Input
                                    label="Present Zip Code"
                                    value={editForm.present_zip}
                                    onChange={(e) => setEditForm({ ...editForm, present_zip: e.target.value })}
                                    required
                                    placeholder="e.g. 560001"
                                    className="h-11"
                                />
                            </div>
                        </div>

                        <div className="h-px bg-slate-100" />

                        {/* Availability */}
                        <div className="space-y-6">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Status</h3>
                            <div className="flex items-center space-x-3 p-4 bg-red-50 rounded-xl border border-red-100">
                                <input
                                    type="checkbox"
                                    id="is_available"
                                    checked={editForm.is_available}
                                    onChange={(e) => setEditForm({ ...editForm, is_available: e.target.checked })}
                                    className="w-5 h-5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                                />
                                <label htmlFor="is_available" className="text-sm font-medium text-gray-700 cursor-pointer select-none flex-1">
                                    I am currently available for blood donation requests
                                </label>
                            </div>
                        </div>

                        <div className="h-px bg-slate-100" />

                        {/* Public Identity */}
                        <div className="space-y-6">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Public Identity</h3>
                            <div className="p-5 bg-slate-50 rounded-xl border border-slate-200">
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <h4 className="font-bold text-slate-900">Make Profile Public</h4>
                                        <p className="text-sm text-slate-500 mt-1">Allow anyone with the link to view your verified donor card. Essential for partner integrations.</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={editForm.is_public_profile}
                                            onChange={(e) => setEditForm({ ...editForm, is_public_profile: e.target.checked })}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>

                                {editForm.is_public_profile && (
                                    <div className="mt-4 pt-4 border-t border-slate-200 animate-in fade-in slide-in-from-top-2">
                                        <p className="text-xs font-bold text-slate-500 uppercase mb-2">Your Public Profile Link</p>
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 font-mono truncate select-all">
                                                {(() => {
                                                    const cleanName = (user?.full_name || 'User').replace(/[^a-zA-Z0-9]/g, '');
                                                    const uniqueId = user?.donor_number || user?.id; // Prefer donor number
                                                    const vanitySlug = `${cleanName}@${uniqueId}`;
                                                    const url = typeof window !== 'undefined' ? `${window.location.origin}/donor/${vanitySlug}` : `/donor/${vanitySlug}`;
                                                    return url;
                                                })()}
                                            </div>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                onClick={() => {
                                                    const cleanName = (user?.full_name || 'User').replace(/[^a-zA-Z0-9]/g, '');
                                                    const uniqueId = user?.donor_number || user?.id;
                                                    const vanitySlug = `${cleanName}@${uniqueId}`;
                                                    window.open(`/donor/${vanitySlug}`, '_blank');
                                                }}
                                                className="shrink-0"
                                            >
                                                Open
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex space-x-4 pt-6">
                            <Button
                                type="submit"
                                size="lg"
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold h-12"
                                disabled={isLoading}
                            >
                                {isLoading ? 'Saving...' : (
                                    <>
                                        <Check className="h-5 w-5 mr-2" />
                                        Save Changes
                                    </>
                                )}
                            </Button>
                            <Button
                                type="button"
                                size="lg"
                                variant="outline"
                                onClick={() => router.push('/profile')}
                                className="h-12 px-8"
                            >
                                Cancel
                            </Button>
                        </div>
                    </form>
                </CardBody>
            </Card>

            {/* Account Security Section */}
            <Card className="border-slate-200 shadow-lg mt-8">
                <CardBody className="p-8">
                    <div className="mb-6">
                        <h3 className="text-lg font-bold text-slate-900">Account Security</h3>
                        <p className="text-slate-500 text-sm">Manage how you access your account.</p>
                    </div>
                    <SecuritySettings />
                </CardBody>
            </Card>

            {/* OTP Verification Modal */}
            {isVerifying && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <Card className="w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
                        <CardHeader className="bg-slate-50 border-b border-slate-100 p-6 text-center">
                            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Lock className="w-6 h-6 text-red-600" />
                            </div>
                            <h2 className="text-xl font-bold text-slate-900">Verify Phone Number</h2>
                            <p className="text-sm text-slate-500 mt-2">
                                We sent a 6-digit code to <span className="font-semibold text-slate-900">{pendingPhone}</span>
                            </p>
                        </CardHeader>
                        <CardBody className="p-6">
                            <form onSubmit={handleVerifyOtp} className="space-y-6">
                                <Input
                                    label="Verification Code"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                    placeholder="000000"
                                    required
                                    className="h-12 text-center text-lg tracking-widest letter-spacing-2"
                                />

                                <div className="space-y-3">
                                    <Button
                                        type="submit"
                                        size="lg"
                                        className="w-full bg-red-600 hover:bg-red-700 text-white font-bold h-12"
                                        disabled={isLoading || otp.length < 6}
                                    >
                                        {isLoading ? 'Verifying...' : 'Verify & Save'}
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        className="w-full text-slate-500"
                                        onClick={() => {
                                            setIsVerifying(false);
                                            setIsLoading(false);
                                            setOtp('');
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            </form>
                        </CardBody>
                    </Card>
                </div>
            )}
        </div>
    );
}
