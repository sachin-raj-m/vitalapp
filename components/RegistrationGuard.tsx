"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { isRegistrationComplete } from '../lib/auth-helpers';
import { PageLoader } from './PageLoader';

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
            <PageLoader />
        );
    }

    return <>{children}</>;
} 