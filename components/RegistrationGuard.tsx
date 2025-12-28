"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { isRegistrationComplete } from '../lib/auth-helpers';
import { Card, CardBody } from './ui/Card';
import { Loader2 } from 'lucide-react';

interface RegistrationGuardProps {
    children: React.ReactNode;
}

export function RegistrationGuard({ children }: RegistrationGuardProps) {
    const router = useRouter();
    const { user } = useAuth();
    const [isChecking, setIsChecking] = useState(true);

    useEffect(() => {
        const checkRegistration = async () => {

            if (!user) {

                router.push('/login');
                return;
            }

            try {

                const isComplete = await isRegistrationComplete(user.id);


                if (!isComplete) {

                    // Store basic info for registration completion
                    const pendingData = {
                        userId: user.id,
                        email: user.email,
                        phone: user.phone || ''
                    };

                    localStorage.setItem('pendingRegistration', JSON.stringify(pendingData));
                    router.push('/complete-registration');
                } else {

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
                router.push('/complete-registration');
            }
        };

        checkRegistration();
    }, [user, router]);

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