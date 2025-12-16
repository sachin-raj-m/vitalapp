"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';
import type { BloodGroup } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { isRegistrationComplete } from '@/utils/auth';

const MAX_FILE_SIZE = 1024 * 1024; // 1MB in bytes

interface PendingRegistration {
    userId: string;
    email: string;
    phone?: string;
}

interface CompleteRegistrationForm {
    fullName: string;
    phone: string;
    bloodGroup: BloodGroup;
    proofType: string;
    proofFile: File | null;
    permanentZip: string;
    presentZip: string;
}

export default function CompleteRegistration() {
    const router = useRouter();
    const { user } = useAuth();
    const [error, setError] = useState<string>('');
    const [status, setStatus] = useState<string>('loading');
    const [progress, setProgress] = useState<number>(0);
    const [pendingData, setPendingData] = useState<PendingRegistration | null>(null);
    const [formData, setFormData] = useState<CompleteRegistrationForm>({
        fullName: '',
        phone: '',
        bloodGroup: '' as BloodGroup,
        proofType: '',
        proofFile: null,
        permanentZip: '',
        presentZip: ''
    });
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        const init = async () => {

            try {
                // First check if we have a user
                if (!user) {
                    router.push('/login');
                    return;
                }



                // Check if registration is already complete
                const isComplete = await isRegistrationComplete(user.id);

                if (isComplete) {
                    router.push('/dashboard');
                    return;
                }

                // Get stored registration data
                const storedData = localStorage.getItem('pendingRegistration');

                if (!storedData) {
                    setError('Registration data not found. Please register again.');
                    router.push('/register');
                    return;
                }

                try {
                    const data = JSON.parse(storedData);

                    if (data.userId !== user.id) {
                        throw new Error('User ID mismatch');
                    }

                    setPendingData(data);
                    // Pre-fill phone if available from pending data
                    if (data.phone) {
                        setFormData(prev => ({ ...prev, phone: data.phone }));
                    }
                    setStatus('form');
                } catch (err) {
                    console.error('Error processing stored data:', err);
                    throw new Error('Invalid registration data');
                }
            } catch (err: any) {
                console.error('Initialization error:', err);
                setError(err.message || 'Failed to load registration data');
                router.push('/register');
            }
        };

        if (user !== undefined) { // Wait for user state to be determined (null or object)
            init();
        }
    }, [router, user]);

    const validateForm = () => {
        const errors: Record<string, string> = {};

        if (!formData.fullName.trim()) {
            errors.fullName = 'Full name is required';
        }

        if (!formData.phone.trim()) {
            errors.phone = 'Phone number is required';
        }

        if (!formData.bloodGroup) {
            errors.bloodGroup = 'Blood group is required';
        }

        if (!formData.proofType) {
            errors.proofType = 'Please select proof type';
        }

        if (!formData.proofFile) {
            errors.proofFile = 'Please upload proof document';
        } else if (formData.proofFile.size > MAX_FILE_SIZE) {
            errors.proofFile = 'File size must be less than 1MB';
        }

        if (!formData.permanentZip.trim()) {
            errors.permanentZip = 'Permanent Zip Code is required';
        }
        if (!formData.presentZip.trim()) {
            errors.presentZip = 'Present Zip Code is required';
        }

        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateForm() || !pendingData) return;

        setStatus('uploading');
        setProgress(25);

        try {
            // Check if user is authenticated
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) throw sessionError;
            if (!session) {
                setError('Authentication required. Please sign in again.');
                router.push('/login');
                return;
            }

            // Verify user ID matches
            if (session.user.id !== pendingData.userId) {
                setError('Session mismatch. Please register again.');
                router.push('/register');
                return;
            }

            // Upload the proof file
            const filePath = `${session.user.id}/${Date.now()}-${formData.proofFile!.name}`;
            const { error: uploadError } = await supabase.storage
                .from('proofs')
                .upload(filePath, formData.proofFile!, {
                    upsert: false,
                    contentType: formData.proofFile!.type
                });

            if (uploadError) throw uploadError;

            setProgress(50);
            setStatus('creating_profile');

            // Create or update user profile using upsert
            const { error: profileError } = await supabase
                .from('profiles')
                .upsert(
                    {
                        id: session.user.id,
                        email: pendingData.email,
                        full_name: formData.fullName,
                        phone: formData.phone,
                        blood_group: formData.bloodGroup,
                        blood_group_proof_type: formData.proofType,
                        blood_group_proof_url: filePath,
                        is_donor: true,
                        is_available: true,
                        permanent_zip: formData.permanentZip,
                        present_zip: formData.presentZip,
                        location: {
                            latitude: 0,
                            longitude: 0,
                            address: '', // Specific address removed as per requirement
                        },
                    },
                    {
                        onConflict: 'id',
                        ignoreDuplicates: false
                    }
                );

            if (profileError) throw profileError;

            setProgress(75);
            setStatus('finalizing');

            // Update user metadata to mark registration as completed
            const { error: updateError } = await supabase.auth.updateUser({
                data: {
                    registration_completed: true,
                    phone: formData.phone
                }
            });

            if (updateError) throw updateError;

            setProgress(100);
            setStatus('completed');

            // Clean up stored data
            localStorage.removeItem('pendingRegistration');

            // Redirect to dashboard after completion
            setTimeout(() => router.push('/dashboard'), 1500);
        } catch (err: any) {
            console.error('Registration completion error:', err);
            setError(err.message || 'Failed to complete registration');
            setStatus('error');
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > MAX_FILE_SIZE) {
                setFieldErrors(prev => ({
                    ...prev,
                    proofFile: 'File size must be less than 1MB'
                }));
            } else {
                setFieldErrors(prev => {
                    const newErrors = { ...prev };
                    delete newErrors.proofFile;
                    return newErrors;
                });
                setFormData(prev => ({ ...prev, proofFile: file }));
            }
        }
    };

    const renderContent = () => {
        switch (status) {
            case 'loading':
                return (
                    <>
                        <h2 className="text-xl font-semibold mb-4">Loading Registration Data</h2>
                        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
                    </>
                );

            case 'form':
                return (
                    <>
                        <h2 className="text-xl font-semibold mb-4">Complete Your Registration</h2>
                        {error && (
                            <Alert variant="error" className="mb-4">
                                {error}
                            </Alert>
                        )}
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <Input
                                label="Full Name"
                                value={formData.fullName}
                                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                required
                                autoComplete="name"
                                placeholder="Enter your full name"
                                error={fieldErrors.fullName}
                            />
                            <Input
                                label="Phone Number"
                                type="tel"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                required
                                autoComplete="tel"
                                placeholder="Enter your phone number"
                                error={fieldErrors.phone}
                            />
                            <Select
                                label="Blood Group"
                                value={formData.bloodGroup}
                                onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value as BloodGroup })}
                                options={[
                                    { value: '', label: 'Select Blood Group' },
                                    { value: 'A+', label: 'A+' },
                                    { value: 'A-', label: 'A-' },
                                    { value: 'B+', label: 'B+' },
                                    { value: 'B-', label: 'B-' },
                                    { value: 'AB+', label: 'AB+' },
                                    { value: 'AB-', label: 'AB-' },
                                    { value: 'O+', label: 'O+' },
                                    { value: 'O+', label: 'O+' },
                                    { value: 'O-', label: 'O-' },
                                ]}
                                required
                                error={fieldErrors.bloodGroup}
                            />

                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label="Permanent Zip Code"
                                    value={formData.permanentZip}
                                    onChange={(e) => setFormData({ ...formData, permanentZip: e.target.value })}
                                    required
                                    placeholder="e.g. 560001"
                                    error={fieldErrors.permanentZip}
                                />
                                <Input
                                    label="Present Zip Code"
                                    value={formData.presentZip}
                                    onChange={(e) => setFormData({ ...formData, presentZip: e.target.value })}
                                    required
                                    placeholder="e.g. 560001"
                                    error={fieldErrors.presentZip}
                                />
                            </div>
                            <Select
                                label="Blood Group Proof Type"
                                value={formData.proofType}
                                onChange={(e) => setFormData({ ...formData, proofType: e.target.value })}
                                options={[
                                    { value: '', label: 'Select Proof Type' },
                                    { value: 'medical_certificate', label: 'Medical Certificate' },
                                    { value: 'hospital_report', label: 'Hospital Report' },
                                    { value: 'blood_donation_card', label: 'Blood Donation Card' },
                                    { value: 'lab_report', label: 'Laboratory Report' },
                                ]}
                                required
                                error={fieldErrors.proofType}
                            />
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700">Upload Proof</label>
                                <Input
                                    type="file"
                                    onChange={handleFileChange}
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    required
                                    className="w-full"
                                    error={fieldErrors.proofFile}
                                />
                                <p className="text-xs text-gray-500">
                                    Accepted formats: PDF, JPG, JPEG, PNG (Max size: 1MB)
                                </p>
                            </div>
                            <Button
                                type="submit"
                                variant="primary"
                                className="w-full"
                            >
                                Complete Registration
                            </Button>
                        </form>
                    </>
                );

            case 'uploading':
            case 'creating_profile':
            case 'finalizing':
                return (
                    <>
                        <h2 className="text-xl font-semibold mb-4">Completing Registration</h2>
                        <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
                            <div
                                className="bg-primary-500 h-2.5 rounded-full transition-all duration-500"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <p className="text-gray-600">
                            {status === 'uploading' && 'Uploading your documents...'}
                            {status === 'creating_profile' && 'Creating your profile...'}
                            {status === 'finalizing' && 'Finalizing your registration...'}
                        </p>
                    </>
                );

            case 'completed':
                return (
                    <>
                        <h2 className="text-xl font-semibold text-green-600 mb-4">
                            Registration Complete!
                        </h2>
                        <p className="text-gray-600 mb-4">
                            Your account has been successfully set up.
                        </p>
                        <p className="text-gray-600">
                            Redirecting you to the dashboard...
                        </p>
                    </>
                );

            case 'error':
                return (
                    <>
                        <h2 className="text-xl font-semibold text-red-600 mb-4">
                            Registration Error
                        </h2>
                        <Alert variant="error" className="mb-4">
                            {error}
                        </Alert>
                        <Button
                            variant="primary"
                            onClick={() => router.push('/register')}
                            className="w-full"
                        >
                            Try Again
                        </Button>
                    </>
                );
        }
    };

    return (
        <div className="max-w-md mx-auto">
            <Card>
                <CardBody className="text-center py-8">
                    {renderContent()}
                </CardBody>
            </Card>
        </div>
    );
}
