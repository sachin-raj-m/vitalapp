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
            if (!user) {
                navigate('/login');
                return;
            }

            try {
                const isComplete = await isRegistrationComplete(user.id);

                if (!isComplete) {
                    // Store basic info for registration completion
                    localStorage.setItem('pendingRegistration', JSON.stringify({
                        userId: user.id,
                        email: user.email,
                        phone: user.phone || ''
                    }));
                    navigate('/complete-registration');
                } else {
                    setIsChecking(false);
                }
            } catch (error) {
                console.error('Error checking registration:', error);
                navigate('/login');
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