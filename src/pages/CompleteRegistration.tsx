import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Input, Select } from '../components/ui/Input';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { supabase } from '../lib/supabase';
import { Loader2 } from 'lucide-react';
import type { BloodGroup } from '../types';
import { useAuth } from '../context/AuthContext';
import { isRegistrationComplete } from '../utils/auth';

const MAX_FILE_SIZE = 1024 * 1024; // 1MB in bytes

interface PendingRegistration {
    userId: string;
    email: string;
    phone: string;
}

interface CompleteRegistrationForm {
    fullName: string;
    bloodGroup: BloodGroup;
    proofType: string;
    proofFile: File | null;
}

export function CompleteRegistration() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [error, setError] = useState<string>('');
    const [status, setStatus] = useState<string>('loading');
    const [progress, setProgress] = useState<number>(0);
    const [pendingData, setPendingData] = useState<PendingRegistration | null>(null);
    const [formData, setFormData] = useState<CompleteRegistrationForm>({
        fullName: '',
        bloodGroup: '' as BloodGroup,
        proofType: '',
        proofFile: null,
    });
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        const init = async () => {
            console.log('Initializing CompleteRegistration page');
            try {
                // First check if we have a user
                if (!user) {
                    console.log('No user found, redirecting to login');
                    navigate('/login');
                    return;
                }

                console.log('Current user:', user);

                // Check if registration is already complete
                const isComplete = await isRegistrationComplete(user.id);
                console.log('Registration status:', isComplete);

                if (isComplete) {
                    console.log('Registration already complete, redirecting to dashboard');
                    navigate('/dashboard');
                    return;
                }

                // Get stored registration data
                const storedData = localStorage.getItem('pendingRegistration');
                console.log('Stored registration data:', storedData);

                if (!storedData) {
                    console.log('No pending registration data found');
                    setError('Registration data not found. Please register again.');
                    navigate('/register');
                    return;
                }

                try {
                    const data = JSON.parse(storedData);
                    console.log('Parsed registration data:', data);

                    if (data.userId !== user.id) {
                        console.log('User ID mismatch:', { stored: data.userId, current: user.id });
                        throw new Error('User ID mismatch');
                    }

                    setPendingData(data);
                    setStatus('form');
                } catch (err) {
                    console.error('Error processing stored data:', err);
                    throw new Error('Invalid registration data');
                }
            } catch (err: any) {
                console.error('Initialization error:', err);
                setError(err.message || 'Failed to load registration data');
                navigate('/register');
            }
        };

        init();
    }, [navigate, user]);

    const validateForm = () => {
        const errors: Record<string, string> = {};

        if (!formData.fullName.trim()) {
            errors.fullName = 'Full name is required';
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
                navigate('/login');
                return;
            }

            // Verify user ID matches
            if (session.user.id !== pendingData.userId) {
                setError('Session mismatch. Please register again.');
                navigate('/register');
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

            // Create user profile
            const { error: profileError } = await supabase
                .from('profiles')
                .insert([
                    {
                        id: session.user.id,
                        email: pendingData.email,
                        full_name: formData.fullName,
                        phone: pendingData.phone,
                        blood_group: formData.bloodGroup,
                        blood_group_proof_type: formData.proofType,
                        blood_group_proof_url: filePath,
                        is_donor: true,
                        is_available: true,
                        location: {
                            latitude: 0,
                            longitude: 0,
                            address: '',
                        },
                    }
                ]);

            if (profileError) throw profileError;

            setProgress(75);
            setStatus('finalizing');

            // Update user metadata to mark registration as completed
            const { error: updateError } = await supabase.auth.updateUser({
                data: {
                    registration_completed: true
                }
            });

            if (updateError) throw updateError;

            setProgress(100);
            setStatus('completed');

            // Clean up stored data
            localStorage.removeItem('pendingRegistration');

            // Redirect to dashboard after completion
            setTimeout(() => navigate('/dashboard'), 1500);
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
                                    { value: 'O-', label: 'O-' },
                                ]}
                                required
                                error={fieldErrors.bloodGroup}
                            />
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
                            onClick={() => navigate('/register')}
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