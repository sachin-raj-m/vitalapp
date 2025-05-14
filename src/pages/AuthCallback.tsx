// components/AuthCallback.tsx
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardBody } from '../components/ui/Card';
import { Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { isRegistrationComplete } from '../utils/auth';

export function AuthCallback() {
    const navigate = useNavigate();

    useEffect(() => {
        const handleCallback = async () => {
            try {
                const { data: { session }, error } = await supabase.auth.getSession();
                if (error) throw error;
                if (!session) {
                    navigate('/login');
                    return;
                }

                // Check if user has completed registration
                const isComplete = await isRegistrationComplete(session.user.id);

                if (!isComplete) {
                    // Store basic info in localStorage for completing registration
                    localStorage.setItem('pendingRegistration', JSON.stringify({
                        userId: session.user.id,
                        email: session.user.email,
                        phone: session.user.phone || ''
                    }));
                    navigate('/complete-registration');
                } else {
                    navigate('/dashboard');
                }
            } catch (error) {
                console.error('Auth callback error:', error);
                navigate('/login');
            }
        };

        handleCallback();
    }, [navigate]);

    return (
        <div className="max-w-md mx-auto">
            <Card>
                <CardBody className="text-center py-8">
                    <h2 className="text-xl font-semibold mb-4">Processing Sign In</h2>
                    <Loader2 className="h-8 w-8 animate-spin text-primary-500 mx-auto" />
                </CardBody>
            </Card>
        </div>
    );
}