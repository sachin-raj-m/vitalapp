import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { supabase } from '../lib/supabase';
import { Loader2 } from 'lucide-react';

interface PendingRegistration {
    userId: string;
    email: string;
    fullName: string;
    phone: string;
    bloodGroup: string;
    proofType: string;
    proofFileName: string;
    proofFileType: string;
    proofFileSize: number;
    proofFileData: string;
}

export function CompleteRegistration() {
    const navigate = useNavigate();
    const [error, setError] = useState<string>('');
    const [status, setStatus] = useState<string>('loading');
    const [progress, setProgress] = useState<number>(0);

    useEffect(() => {
        completeRegistration();
    }, []);

    const completeRegistration = async () => {
        try {
            // Check if user is authenticated
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) throw sessionError;
            if (!session) {
                setError('Authentication required. Please sign in again.');
                setTimeout(() => navigate('/login'), 3000);
                return;
            }

            // Get stored registration data
            const storedData = localStorage.getItem('pendingRegistration');
            if (!storedData) {
                setError('Registration data not found. Please register again.');
                setTimeout(() => navigate('/register'), 3000);
                return;
            }

            const registrationData: PendingRegistration = JSON.parse(storedData);

            // Verify user ID matches
            if (session.user.id !== registrationData.userId) {
                setError('Session mismatch. Please register again.');
                setTimeout(() => navigate('/register'), 3000);
                return;
            }

            setStatus('uploading');
            setProgress(25);

            // Convert base64 to file
            const base64Response = await fetch(registrationData.proofFileData);
            const blob = await base64Response.blob();
            const file = new File([blob], registrationData.proofFileName, {
                type: registrationData.proofFileType
            });

            // Upload the proof file
            const filePath = `${session.user.id}/${Date.now()}-${registrationData.proofFileName}`;
            const { error: uploadError } = await supabase.storage
                .from('proofs')
                .upload(filePath, file, {
                    upsert: false,
                    contentType: registrationData.proofFileType
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
                        email: registrationData.email,
                        full_name: registrationData.fullName,
                        phone: registrationData.phone,
                        blood_group: registrationData.bloodGroup,
                        blood_group_proof_type: registrationData.proofType,
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

            // Redirect to dashboard
            setTimeout(() => navigate('/dashboard'), 1500);
        } catch (err: any) {
            console.error('Registration completion error:', err);
            setError(err.message || 'Failed to complete registration');
            setStatus('error');
        }
    };

    const renderContent = () => {
        switch (status) {
            case 'loading':
                return (
                    <>
                        <h2 className="text-xl font-semibold mb-4">Preparing Registration</h2>
                        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
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