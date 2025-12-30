"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { useAuth } from '@/context/AuthContext';
import { ArrowLeft, Check } from 'lucide-react';

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
        setError('');
        setIsLoading(true);

        try {
            await updateProfile({
                full_name: editForm.full_name,
                phone: editForm.phone,
                is_available: editForm.is_available,
                permanent_zip: editForm.permanent_zip,
                present_zip: editForm.present_zip
            });
            router.push('/profile');
        } catch (err: any) {
            console.error('Error updating profile');
            setError('Failed to update profile');
        } finally {
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
        </div>
    );
}
