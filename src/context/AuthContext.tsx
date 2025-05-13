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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Initial session:', session);
      setState(prev => ({ ...prev, session }));

      if (session?.user?.id) {
        console.log('Found session user:', session.user);
        fetchUserProfile(session.user.id);
      } else {
        console.log('No session found');
        setState(prev => ({ ...prev, loading: false }));
      }
    });

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
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchUserProfile = async (userId: string) => {
    try {
      console.log('Fetching user profile for:', userId);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        throw error;
      }

      if (data) {
        console.log('User profile fetched:', data);
        setState(prev => ({
          ...prev,
          user: data as User,
          loading: false,
          error: null
        }));
      } else {
        console.log('No profile found, creating new profile');
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
          console.log('Profile already exists:', existingProfile);
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

  const signIn = async (email: string, password: string) => {
    try {
      console.log('Starting sign in...');
      setState(prev => ({ ...prev, loading: true, error: null }));
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      console.log('Sign in response:', { data, error });
      if (error) throw error;
    } catch (error) {
      console.error('Sign in error:', error);
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

  const value = {
    ...state,
    signIn,
    signUp,
    signOut,
    updateProfile,
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