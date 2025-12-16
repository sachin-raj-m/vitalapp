"use client";

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
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
  forceResetAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper function to cache profile in localStorage
const cacheUserProfile = (profile: User) => {
  try {
    localStorage.setItem('vital_user_profile', JSON.stringify(profile));
  } catch (err) {
    console.warn('Failed to cache profile in localStorage');
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
    console.warn('Failed to read cached profile');
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

  // Use refs to prevent infinite loops
  const isInitialized = useRef(false);
  const isRefreshing = useRef(false);
  const lastProfileFetch = useRef<number>(0);

  const fetchUserProfile = async (userId: string) => {
    // Prevent duplicate fetches within 2 seconds
    const now = Date.now();
    if (now - lastProfileFetch.current < 2000) {

      return state.user;
    }

    if (isRefreshing.current) {

      return state.user;
    }

    isRefreshing.current = true;
    lastProfileFetch.current = now;

    try {

      setState(prev => ({ ...prev, loading: true }));

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        setState(prev => ({ ...prev, loading: false, error: error as Error }));
        throw error;
      }

      if (data) {


        // Cache the profile in localStorage
        cacheUserProfile(data as User);

        // Set user immediately
        setState(prev => ({
          ...prev,
          user: data as User,
          loading: false,
          error: null
        }));

        return data as User;
      } else {


        // Get user data from auth
        const { data: { user: authUser } } = await supabase.auth.getUser();

        if (!authUser) {
          throw new Error('No auth user found');
        }



        // Create a new profile
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

          // Check for duplicate key error (profile might have been created in another tab/request)
          if (createError.code === '23505') {

            const { data: existingProfile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', userId)
              .single();

            if (existingProfile) {
              cacheUserProfile(existingProfile as User);
              setState(prev => ({
                ...prev,
                user: existingProfile as User,
                loading: false,
                error: null
              }));
              return existingProfile as User;
            }
          }

          setState(prev => ({ ...prev, loading: false, error: createError as Error }));
          throw createError;
        }


        cacheUserProfile(newProfile as User);
        setState(prev => ({
          ...prev,
          user: newProfile as User,
          loading: false,
          error: null
        }));

        return newProfile as User;
      }
    } catch (error) {
      console.error('Error in fetchUserProfile:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error as Error
      }));
      throw error;
    } finally {
      isRefreshing.current = false;
    }
  };

  // Add this function to force reset auth state
  const forceResetAuth = async () => {
    try {
      // Clear all auth state
      localStorage.removeItem('vital_user_profile');
      localStorage.removeItem('vital_supabase_auth');

      // Sign out from supabase
      await supabase.auth.signOut({ scope: 'global' });

      // Reset state
      setState({
        user: null,
        session: null,
        loading: false,
        error: null,
      });
    } catch (error) {
      console.error('Error in force reset:', error);
      setState({
        user: null,
        session: null,
        loading: false,
        error: error as Error,
      });
    }
  };

  // Add this state monitoring useEffect
  useEffect(() => {
    // Skip recovery during initialization
    if (!isInitialized.current) return;

    // Only attempt recovery if we have a session but no user
    if (state.session?.user?.id && !state.user && !state.loading && !isRefreshing.current) {
      console.warn('Inconsistent state: Session exists but no user profile');

      // Try to recover from localStorage first
      const userId = state.session.user.id;
      const cachedProfile = getCachedUserProfile(userId);

      if (cachedProfile) {

        setState(prev => ({ ...prev, user: cachedProfile }));
      } else {
        // Only refresh if not already refreshing

        refreshProfile().catch(err => {
          console.error('Recovery attempt failed:', err);
        });
      }
    }
  }, [state.session, state.user, state.loading]);

  useEffect(() => {
    // Initialize auth
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        // Set session immediately
        setState(prev => ({ ...prev, session }));

        if (session?.user?.id) {


          // Try cached profile first for immediate display
          const cachedProfile = getCachedUserProfile(session.user.id);
          if (cachedProfile) {

            setState(prev => ({
              ...prev,
              user: cachedProfile,
              loading: false
            }));
          }

          // Still fetch fresh profile from DB
          try {
            await fetchUserProfile(session.user.id);
          } catch (err) {
            console.error('Error fetching profile during init:', err);
            // Don't set loading=false again if we already set it with cached profile
            if (!cachedProfile) {
              setState(prev => ({ ...prev, loading: false }));
            }
          }
        } else {

          setState(prev => ({ ...prev, loading: false }));
        }

        // Mark initialization as complete
        isInitialized.current = true;
      } catch (error) {
        console.error('Error initializing auth:', error);
        setState(prev => ({
          ...prev,
          loading: false,
          error: error as Error
        }));
        isInitialized.current = true;
      }
    };

    // Run initialization
    initializeAuth();

    // Listen for auth changes with improved error handling
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        try {


          // Update session state immediately
          setState(prev => ({ ...prev, session }));

          if (event === 'SIGNED_IN' && session?.user?.id) {


            // Try cached profile first for immediate display
            const cachedProfile = getCachedUserProfile(session.user.id);
            if (cachedProfile) {

              setState(prev => ({
                ...prev,
                user: cachedProfile
              }));
            }

            // Wait a moment before fetching profile to avoid race conditions
            setTimeout(async () => {
              try {
                await fetchUserProfile(session.user.id);
              } catch (err) {
                console.error('Error fetching profile after sign in:', err);
                setState(prev => ({ ...prev, loading: false }));
              }
            }, 500);
          } else if (event === 'SIGNED_OUT') {

            localStorage.removeItem('vital_user_profile');
            setState(prev => ({ ...prev, user: null, loading: false }));
          } else if (event === 'TOKEN_REFRESHED' && session?.user?.id) {
            // Only fetch profile if we don't have one and not already loading
            if (!state.user && !state.loading && !isRefreshing.current) {
              try {
                await fetchUserProfile(session.user.id);
              } catch (err) {
                console.error('Error fetching profile after token refresh:', err);
                setState(prev => ({ ...prev, loading: false }));
              }
            }
          }
        } catch (err) {
          console.error('Error handling auth state change:', err);
          setState(prev => ({ ...prev, loading: false }));
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (error) {
      console.error('Sign in error:', error);
      setState(prev => ({ ...prev, error: error as Error, loading: false }));
      throw error;
    }
  };

  const signInWithGoogle = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;
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
      // If already refreshing, exit early
      // If already refreshing, exit early
      if (isRefreshing.current) {
        return;
      }

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
    forceResetAuth,
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