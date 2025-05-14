import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  session: any | null;
  loading: boolean;
  error: Error | null;
}

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, userData: Partial<User>) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper function to cache profile in localStorage
const cacheUserProfile = (profile: User) => {
  try {
    localStorage.setItem('vital_user_profile', JSON.stringify(profile));
  } catch (err) {
    console.warn('Failed to cache profile in localStorage:', err);
  }
};

// Helper function to get cached profile
const getCachedUserProfile = (userId: string): User | null => {
  try {
    const cachedProfile = localStorage.getItem('vital_user_profile');
    if (cachedProfile) {
      const parsedProfile = JSON.parse(cachedProfile);
      if (parsedProfile.id === userId) {
        return parsedProfile as User;
      }
    }
  } catch (err) {
    console.warn('Failed to read cached profile:', err);
  }
  return null;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    error: null,
  });

  const fetchUserProfile = async (userId: string) => {
    try {
      console.log('Fetching user profile for:', userId);
      setState(prev => ({ ...prev, loading: true }));
      
      // Add retry logic for better reliability
      let retries = 0;
      const maxRetries = 3;
      let data = null;
      let error = null;
      
      while (retries < maxRetries && !data && !error) {
        const result = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
        
        data = result.data;
        error = result.error;
        
        if (!data && !error) {
          retries++;
          console.log(`No profile found, retrying (${retries}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, 500)); // Wait before retry
        }
      }

      if (error) {
        console.error('Error fetching profile:', error);
        throw error;
      }

      if (data) {
        console.log('User profile fetched:', data);
        
        // Cache the profile in localStorage
        cacheUserProfile(data as User);
        
        setState(prev => ({
          ...prev,
          user: data as User,
          loading: false,
          error: null
        }));
      } else {
        console.log('No profile found after retries, creating new profile');
        // Get user data from auth
        const { data: { user: authUser } } = await supabase.auth.getUser();
        console.log('Auth user data:', authUser);

        // First check if profile exists again (race condition protection)
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (existingProfile) {
          console.log('Profile found on double-check:', existingProfile);
          
          // Cache the profile in localStorage
          cacheUserProfile(existingProfile as User);
          
          setState(prev => ({
            ...prev,
            user: existingProfile as User,
            loading: false,
            error: null
          }));
          return;
        }

        // Create a new profile if it doesn't exist
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            email: authUser?.email,
            full_name: authUser?.user_metadata?.full_name || authUser?.email?.split('@')[0],
            is_donor: false,
            is_available: false,
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating profile:', createError);
          // If there's a conflict, try to fetch the profile again
          if (createError.code === '23505') {
            const { data: conflictProfile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', userId)
              .single();

            if (conflictProfile) {
              // Cache the profile in localStorage
              cacheUserProfile(conflictProfile as User);
              
              setState(prev => ({
                ...prev,
                user: conflictProfile as User,
                loading: false,
                error: null
              }));
              return;
            }
          }
          throw createError;
        }

        console.log('New profile created:', newProfile);
        
        // Cache the new profile in localStorage
        cacheUserProfile(newProfile as User);
        
        setState(prev => ({
          ...prev,
          user: newProfile as User,
          loading: false,
          error: null
        }));
      }
    } catch (error) {
      console.error('Error in fetchUserProfile:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error as Error
      }));
    }
  };

  useEffect(() => {
    // Initialize auth
    const initializeAuth = async () => {
      try {
        console.log('Initializing auth...');
        // First check if we have a session
        const { data: { session } } = await supabase.auth.getSession();
        console.log('Initial session check:', session);
        
        setState(prev => ({ ...prev, session }));

        if (session?.user?.id) {
          console.log('Found session user, fetching profile:', session.user.id);
          
          // Try to get profile from localStorage while fetching from DB
          const cachedProfile = getCachedUserProfile(session.user.id);
          if (cachedProfile) {
            console.log('Using cached profile while fetching from DB');
            setState(prev => ({
              ...prev,
              user: cachedProfile,
              // Still loading as we want the fresh data
              loading: true
            }));
          }
          
          await fetchUserProfile(session.user.id);
        } else {
          console.log('No session found');
          setState(prev => ({ ...prev, loading: false }));
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        setState(prev => ({ 
          ...prev, 
          loading: false, 
          error: error as Error 
        }));
      }
    };

    // Run initialization
    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session);
        setState(prev => ({ ...prev, session }));

        if (event === 'SIGNED_IN' && session?.user?.id) {
          console.log('User signed in:', session.user);
          await fetchUserProfile(session.user.id);
        } else if (event === 'SIGNED_OUT') {
          console.log('User signed out');
          setState(prev => ({ ...prev, user: null, loading: false }));
          // Clear cached profile on sign out
          localStorage.removeItem('vital_user_profile');
        } else if (event === 'TOKEN_REFRESHED' && session?.user?.id) {
          // Make sure to handle token refreshes as well
          console.log('Token refreshed, ensuring profile is up to date');
          
          // Only re-fetch if we don't have a user already
          if (!state.user && !state.loading) {
            await fetchUserProfile(session.user.id);
          }
        } else if (event === 'USER_UPDATED' && session?.user?.id) {
          console.log('User updated, refreshing profile');
          await fetchUserProfile(session.user.id);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      console.log('Starting sign in...');
      setState(prev => ({ ...prev, loading: true, error: null }));
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      console.log('Sign in response:', { data, error });
      if (error) throw error;
      
      // The user profile will be fetched via the auth state change listener
    } catch (error) {
      console.error('Sign in error:', error);
      setState(prev => ({ ...prev, error: error as Error, loading: false }));
      throw error;
    }
  };

  const signInWithGoogle = async () => {
    try {
      console.log('Starting Google sign in...');
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      
      console.log('Google sign in response:', { data, error });
      if (error) throw error;
      
      // The redirect happens automatically, so we don't need to do anything else here
    } catch (error) {
      console.error('Google sign in error:', error);
      setState(prev => ({ ...prev, error: error as Error, loading: false }));
      throw error;
    }
  };

  const signUp = async (email: string, password: string, userData: Partial<User>) => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      // Create auth user
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: userData.full_name,
          }
        }
      });

      if (error) throw error;

      if (data.user) {
        // Create profile record
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            email,
            full_name: userData.full_name,
            phone: userData.phone,
            blood_group: userData.blood_group,
            location: userData.location,
            is_donor: userData.is_donor || false,
            is_available: userData.is_available || false,
          });

        if (profileError) throw profileError;
      }
    } catch (error) {
      setState(prev => ({ ...prev, error: error as Error, loading: false }));
      throw error;
    }
  };

  const signOut = async () => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      // Clear cached profile
      localStorage.removeItem('vital_user_profile');
    } catch (error) {
      setState(prev => ({ ...prev, error: error as Error, loading: false }));
      throw error;
    }
  };

  const updateProfile = async (data: Partial<User>) => {
    try {
      if (!state.user?.id) throw new Error('No user logged in');

      setState(prev => ({ ...prev, loading: true }));

      const { error } = await supabase
        .from('profiles')
        .update(data)
        .eq('id', state.user.id);

      if (error) throw error;

      // Refresh user data
      await fetchUserProfile(state.user.id);
    } catch (error) {
      setState(prev => ({ ...prev, error: error as Error, loading: false }));
      throw error;
    }
  };

  const refreshProfile = async () => {
    try {
      console.log('Manually refreshing profile...');
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      // Get current user from session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user?.id) {
        await fetchUserProfile(session.user.id);
      } else {
        setState(prev => ({ 
          ...prev, 
          loading: false,
          error: new Error('No authenticated user found')
        }));
      }
    } catch (error) {
      console.error('Error refreshing profile:', error);
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: error as Error 
      }));
    }
  };

  const value = {
    ...state,
    signIn,
    signUp,
    signOut,
    updateProfile,
    signInWithGoogle,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};