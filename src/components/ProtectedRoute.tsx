// components/ProtectedRoute.tsx
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate, useLocation } from 'react-router-dom';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, session, loading, error, refreshProfile } = useAuth();
  const location = useLocation();
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    console.log('ProtectedRoute state:', { user, loading, session });
  }, [user, loading, session]);
  
  // Handle missing profile data despite active session
  useEffect(() => {
    if (session?.user?.id && !user && !loading && retryCount < 3) {
      console.log(`Profile missing despite active session, refreshing (attempt ${retryCount + 1})`);
      refreshProfile();
      setRetryCount(prevCount => prevCount + 1);
    }
  }, [session, user, loading, refreshProfile, retryCount]);

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
  
  // After 3 retries, if still no user profile, redirect to login
  if ((!user || !session) && (!loading || retryCount >= 3)) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  console.log('ProtectedRoute: Rendering protected content');
  return <>{children}</>;
}