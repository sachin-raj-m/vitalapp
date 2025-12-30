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

export default function ProfileEditPage() {
    const router = useRouter();
    const { user, updateProfile } = useAuth();
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const [editForm, setEditForm] = useState({
        full_name: '',
        phone: '',
        is_available: false,
        permanent_zip: '',
        present_zip: ''
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
                present_zip: user.present_zip || ''
            });
        }
    }, [user]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setError('');
        setIsLoading(true);

        try {
            // Check if phone number changed
            if (editForm.phone !== user?.phone) {
                // Initiate Phone Verification
                const { error: authError } = await supabase.auth.updateUser({
                    phone: editForm.phone
                });

                if (authError) throw authError;

                setPendingPhone(editForm.phone);
                setIsVerifying(true);
                setIsLoading(false); // Stop loading to show modal
                return;
            }

            // Normal update without phone change
            await updateProfile({
                full_name: editForm.full_name,
                is_available: editForm.is_available,
                permanent_zip: editForm.permanent_zip,
                present_zip: editForm.present_zip
                // phone is not updated here directly if not changed
            });
            router.push('/profile');
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

        console.log('Verifying OTP for phone:', pendingPhone);

        try {
            const { data, error: verifyError } = await supabase.auth.verifyOtp({
                phone: pendingPhone,
                token: otp,
                type: 'phone_change'
            });

            if (verifyError) {
                console.error('Supabase verifyOtp error:', verifyError);
                throw verifyError;
            }

            console.log('OTP verified successfully:', data);

            // Update remaining profile details
            await updateProfile({
                full_name: editForm.full_name,
                phone: pendingPhone, // Explicitly set new phone in profiles table
                is_available: editForm.is_available,
                permanent_zip: editForm.permanent_zip,
                present_zip: editForm.present_zip
            });

            console.log('Profile updated successfully, redirecting...');
            alert('Phone number verified and profile updated successfully!');
            router.push('/profile');
        } catch (err: any) {
            console.error('Error verifying OTP/Profile:', err);
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
