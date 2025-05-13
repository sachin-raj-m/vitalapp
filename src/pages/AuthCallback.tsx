import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export function AuthCallback() {
    const navigate = useNavigate();
    const { user } = useAuth();

    useEffect(() => {
        const handleAuthCallback = async () => {
            try {
                const { data: { session }, error } = await supabase.auth.getSession();

                if (error) {
                    console.error('Auth callback error:', error);
                    navigate('/login');
                    return;
                }

                if (session) {
                    // Wait a moment for the auth state to be updated
                    setTimeout(() => {
                        navigate('/dashboard');
                    }, 100);
                } else {
                    navigate('/login');
                }
            } catch (err) {
                console.error('Error in auth callback:', err);
                navigate('/login');
            }
        };

        handleAuthCallback();
    }, [navigate]);

    // Also redirect if user is already authenticated
    useEffect(() => {
        if (user) {
            navigate('/dashboard');
        }
    }, [user, navigate]);

    return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
                <h2 className="text-xl font-semibold mb-2">Completing sign in...</h2>
                <p className="text-gray-600">Please wait while we redirect you.</p>
            </div>
        </div>
    );
} 