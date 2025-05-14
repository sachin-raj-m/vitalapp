import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export function AuthCallback() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();

    useEffect(() => {
        const handleAuthCallback = async () => {
            try {
                // Parse the URL to extract the code and error if present
                const searchParams = new URLSearchParams(location.hash.substring(1));
                const accessToken = searchParams.get('access_token');
                const refreshToken = searchParams.get('refresh_token');
                const error = searchParams.get('error');
                const errorDescription = searchParams.get('error_description');

                if (error) {
                    console.error('Auth error:', error, errorDescription);
                    navigate('/login');
                    return;
                }

                if (accessToken) {
                    // Set the tokens in local storage (already done by Supabase)
                    console.log('OAuth successful, setting session');
                    
                    // Get the current session (should be populated after redirect)
                    const { data, error: sessionError } = await supabase.auth.getSession();
                    
                    if (sessionError) {
                        console.error('Session retrieval error:', sessionError);
                        navigate('/login');
                        return;
                    }

                    if (data.session) {
                        console.log('Session established');
                        // Wait a moment for the auth state to update in the context
                        setTimeout(() => {
                            navigate('/dashboard');
                        }, 500); // Increased delay to ensure context updates
                    } else {
                        console.error('No session established after redirect');
                        navigate('/login');
                    }
                } else {
                    console.log('No tokens found in URL');
                    
                    // Check if we already have a session anyway
                    const { data } = await supabase.auth.getSession();
                    if (data.session) {
                        navigate('/dashboard');
                    } else {
                        navigate('/login');
                    }
                }
            } catch (err) {
                console.error('Error in auth callback:', err);
                navigate('/login');
            }
        };

        // Only run the callback handler if we're not already authenticated
        if (!user) {
            handleAuthCallback();
        } else {
            navigate('/dashboard');
        }
    }, [location, navigate, user]);

    return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
                <h2 className="text-xl font-semibold mb-2">Completing sign in...</h2>
                <p className="text-gray-600">Please wait while we redirect you.</p>
            </div>
        </div>
    );
}