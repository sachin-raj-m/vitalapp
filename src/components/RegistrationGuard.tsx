import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isRegistrationComplete } from '../utils/auth';
import { Card, CardBody } from './ui/Card';
import { Loader2 } from 'lucide-react';

interface RegistrationGuardProps {
    children: React.ReactNode;
}

export function RegistrationGuard({ children }: RegistrationGuardProps) {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [isChecking, setIsChecking] = useState(true);

    useEffect(() => {
        const checkRegistration = async () => {
            console.log('RegistrationGuard: Checking registration status');
            if (!user) {
                console.log('RegistrationGuard: No user found, redirecting to login');
                navigate('/login');
                return;
            }

            try {
                console.log('RegistrationGuard: Checking completion for user:', user.id);
                const isComplete = await isRegistrationComplete(user.id);
                console.log('RegistrationGuard: Registration complete?', isComplete);

                if (!isComplete) {
                    console.log('RegistrationGuard: Registration incomplete, redirecting to complete registration');
                    // Store basic info for registration completion
                    const pendingData = {
                        userId: user.id,
                        email: user.email,
                        phone: user.phone || ''
                    };
                    console.log('RegistrationGuard: Storing pending data:', pendingData);
                    localStorage.setItem('pendingRegistration', JSON.stringify(pendingData));
                    navigate('/complete-registration');
                } else {
                    console.log('RegistrationGuard: Registration complete, allowing access');
                    setIsChecking(false);
                }
            } catch (error) {
                console.error('RegistrationGuard: Error checking registration:', error);
                // On error, redirect to complete registration
                const pendingData = {
                    userId: user.id,
                    email: user.email,
                    phone: user.phone || ''
                };
                localStorage.setItem('pendingRegistration', JSON.stringify(pendingData));
                navigate('/complete-registration');
            }
        };

        checkRegistration();
    }, [user, navigate]);

    if (isChecking) {
        return (
            <div className="max-w-md mx-auto">
                <Card>
                    <CardBody className="text-center py-8">
                        <h2 className="text-xl font-semibold mb-4">Checking Profile</h2>
                        <Loader2 className="h-8 w-8 animate-spin text-primary-500 mx-auto" />
                    </CardBody>
                </Card>
            </div>
        );
    }

    return <>{children}</>;
} 