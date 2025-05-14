// components/AuthCallback.tsx
import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export function AuthCallback() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, refreshProfile } = useAuth();
    const [isProcessing, setIsProcessing] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const handleAuthCallback = async () => {
            try {
                console.log('Auth callback processing');
                console.log('URL hash:', location.hash);
                console.log('URL search:', location.search);
                
                // For easier debugging, print URL parameters
                const params = new URLSearchParams(location.search);
                const searchParams = Object.fromEntries(params.entries());
                console.log('URL search params:', searchParams);
                
                const hashParams = new URLSearchParams(location.hash.substring(1));
                const hashParamEntries = Object.fromEntries(hashParams.entries());
                console.log('URL hash params:', hashParamEntries);

                // Parse hash for tokens (OAuth redirects use hash fragments)
                const accessToken = hashParams.get('access_token');
                const errorParam = hashParams.get('error');
                const errorDescription = hashParams.get('error_description');

                if (errorParam) {
                    console.error('Auth error:', errorParam, errorDescription);
                    setError(`Authentication error: ${errorDescription || errorParam}`);
                    setIsProcessing(false);
                    setTimeout(() => navigate('/login'), 3000);
                    return;
                }

                // Check for code in search params (OAuth code flow)
                const code = params.get('code');
                if (code) {
                    console.log('Code found in URL, exchanging for session');
                    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
                    if (error) {
                        throw error;
                    }
                    console.log('Code exchange successful:', data);
                }

                // Get the session
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();

                if (sessionError) {
                    console.error('Session retrieval error:', sessionError);
                    throw sessionError;
                }

                if (session) {
                    console.log('Session established, refreshing profile');
                    await refreshProfile();
                    
                    // Delayed navigation to ensure context is updated
                    setTimeout(() => {
                        setIsProcessing(false);
                        navigate('/dashboard');
                    }, 500);
                } else {
                    console.error('No session established after redirect');
                    setError('Failed to establish a session. Please try again.');
                    setIsProcessing(false);
                    setTimeout(() => navigate('/login'), 3000);
                }
            } catch (err) {
                console.error('Error in auth callback:', err);
                setError('An unexpected error occurred. Please try again.');
                setIsProcessing(false);
                setTimeout(() => navigate('/login'), 3000);
            }
        };

        // Only run the callback handler if we're not already authenticated
        if (!user) {
            handleAuthCallback();
        } else {
            setIsProcessing(false);
            navigate('/dashboard');
        }
    }, [location, navigate, user, refreshProfile]);

    return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
                {isProcessing ? (
                    <>
                        <h2 className="text-xl font-semibold mb-2">Completing sign in...</h2>
                        <p className="text-gray-600">Please wait while we redirect you.</p>
                    </>
                ) : error ? (
                    <>
                        <h2 className="text-xl font-semibold mb-2 text-red-600">Sign in error</h2>
                        <p className="text-gray-600">{error}</p>
                        <p className="text-gray-600 mt-2">Redirecting to login page...</p>
                    </>
                ) : (
                    <>
                        <h2 className="text-xl font-semibold mb-2 text-green-600">Sign in successful!</h2>
                        <p className="text-gray-600">Redirecting to dashboard...</p>
                    </>
                )}
            </div>
        </div>
    );
}