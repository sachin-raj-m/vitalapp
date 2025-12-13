"use client";

// components/ProtectedRoute.tsx
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
      router.push(`/login?from=${pathname}`);
    }
  }, [user, session, loading, retryCount, router, pathname]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Loading...</h2>
          <p className="text-gray-600">Please wait while we prepare your dashboard.</p>
        </div>
      </div>
    );
  }

  if ((!user || !session) && (!loading || retryCount >= 3)) {
    return null; // Or a loading spinner while redirecting
  }


  return <>{children}</>;
}