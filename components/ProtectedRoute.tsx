"use client";

// components/ProtectedRoute.tsx
import { PageLoader } from './PageLoader';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, session, loading, error, refreshProfile } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [retryCount, setRetryCount] = useState(0);



  // Handle missing profile data despite active session
  useEffect(() => {
    if (session?.user?.id && !user && !loading && retryCount < 3) {

      refreshProfile();
      setRetryCount(prevCount => prevCount + 1);
    }
  }, [session, user, loading, refreshProfile, retryCount]);

  // After 3 retries, if still no user profile, redirect to login
  useEffect(() => {
    if ((!user || !session) && (!loading || retryCount >= 3)) {
      router.push(`/login?redirect=${encodeURIComponent(pathname || '/dashboard')}`);
    }
  }, [user, session, loading, retryCount, router, pathname]);

  // Only block the page while there's no user yet. Background profile refreshes
  // (e.g. Supabase re-announcing SIGNED_IN when the tab regains focus) must not
  // unmount the page, or its local state (tabs, forms, open dialogs) is lost.
  if (loading && !user) {
    return (
      <PageLoader />
    );
  }

  if ((!user || !session) && (!loading || retryCount >= 3)) {
    return null; // Or a loading spinner while redirecting
  }


  return <>{children}</>;
}