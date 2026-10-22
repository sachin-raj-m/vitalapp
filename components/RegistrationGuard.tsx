"use client";

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { REQUESTER_PATHS, accountStage } from '../lib/auth-helpers';
import { PageLoader } from './PageLoader';

interface RegistrationGuardProps {
    children: React.ReactNode;
}

/**
 * Donor pages need a finished (short) donor registration. Accounts that are
 * only here to request blood are never sent through the donor form: they can
 * open their profile and settings, and anything else takes them to their
 * requests (lib/auth-helpers.ts accountStage).
 */
export function RegistrationGuard({ children }: RegistrationGuardProps) {
    const router = useRouter();
    const pathname = usePathname() || '';
    const { user, session } = useAuth();
    const [isChecking, setIsChecking] = useState(true);

    useEffect(() => {
        if (!user) {
            router.push('/login');
            return;
        }
        let cancelled = false;
        accountStage(user.id, session?.user?.user_metadata)
            .catch(() => 'new' as const)
            .then(stage => {
                if (cancelled) return;
                if (stage === 'complete') { setIsChecking(false); return; }
                if (stage === 'requester') {
                    if (REQUESTER_PATHS.some(p => pathname.startsWith(p))) setIsChecking(false);
                    else router.push('/requests/my-requests');
                    return;
                }
                router.push('/complete-registration');
            });
        return () => { cancelled = true; };
        // Re-checked per account and page; session metadata is read as it is then.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id, pathname, router]);

    if (isChecking) {
        return (
            <PageLoader />
        );
    }

    return <>{children}</>;
}
