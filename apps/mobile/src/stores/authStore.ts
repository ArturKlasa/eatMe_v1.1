/**
 * Auth Store - Zustand-based authentication state management
 *
 * Handles user authentication state, session management, and auth operations
 * using Supabase Auth.
 */

import { create } from 'zustand';
import { supabase, getOAuthRedirectUrl } from '../lib/supabase';
import { Session, User, AuthError, Subscription } from '@supabase/supabase-js';
import { debugLog } from '../config/environment';
import { useFilterStore } from './filterStore';
import { useOnboardingStore } from './onboardingStore';
import * as WebBrowser from 'expo-web-browser';

// Track if auth listener is already set up (prevents duplicate listeners)
let authListenerSubscription: Subscription | null = null;

// Auth state interface
export interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
}

// Auth actions interface
interface AuthActions {
  // Initialize auth - check for existing session
  initialize: () => Promise<void>;

  // Sign in with email/password
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;

  // Sign up with email/password
  signUp: (
    email: string,
    password: string,
    metadata?: { profile_name?: string }
  ) => Promise<{ error: AuthError | null; needsEmailVerification: boolean }>;

  // Sign out
  signOut: () => Promise<{ error: AuthError | null }>;

  // Send password reset email
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;

  // Update password (when user is logged in)
  updatePassword: (newPassword: string) => Promise<{ error: AuthError | null }>;

  // Update user profile
  updateProfile: (data: {
    profile_name?: string;
    avatar_url?: string;
  }) => Promise<{ error: Error | null }>;

  // Sign in with OAuth provider (Google/Facebook)
  signInWithOAuth: (provider: 'google' | 'facebook') => Promise<{ error: Error | null }>;

  // Clear error
  clearError: () => void;

  // Set session (for auth state changes)
  setSession: (session: Session | null) => void;
}

// Combined store type
type AuthStore = AuthState & AuthActions;

// Create the auth store
export const useAuthStore = create<AuthStore>((set, get) => ({
  // Initial state
  user: null,
  session: null,
  isLoading: true,
  isInitialized: false,
  error: null,

  // Initialize auth - check for existing session
  initialize: async () => {
    // Prevent multiple initializations
    const state = get();
    if (state.isInitialized) {
      debugLog('[Auth] Already initialized, skipping...');
      return;
    }

    try {
      debugLog('[Auth] Initializing...');
      set({ isLoading: true, error: null });

      // Get current session
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.error('[Auth] Error getting session:', error);
        set({ error: error.message, isLoading: false, isInitialized: true });
        return;
      }

      debugLog('[Auth] Session found:', !!session);

      // Batch state update to reduce re-renders
      set({
        session,
        user: session?.user ?? null,
        isLoading: false,
        isInitialized: true,
      });

      // Sync user preferences from database if logged in (don't await to not block)
      if (session?.user) {
        useFilterStore.getState().syncWithDatabase(session.user.id);
        useOnboardingStore.getState().loadUserPreferences(session.user.id);
      }

      // Set up auth state change listener ONLY ONCE
      if (!authListenerSubscription) {
        debugLog('[Auth] Setting up auth state listener...');
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
          debugLog('[Auth] Auth state changed:', event);

          // Batch update to reduce re-renders
          set({
            session,
            user: session?.user ?? null,
          });

          // Sync preferences on sign in (don't await)
          if (event === 'SIGNED_IN' && session?.user) {
            useFilterStore.getState().syncWithDatabase(session.user.id);
            useOnboardingStore.getState().loadUserPreferences(session.user.id);
          }
        });
        authListenerSubscription = subscription;
      }
    } catch (err) {
      console.error('[Auth] Initialization error:', err);
      set({
        error: 'Failed to initialize authentication',
        isLoading: false,
        isInitialized: true,
      });
    }
  },

  // Sign in with email/password
  signIn: async (email: string, password: string) => {
    try {
      set({ isLoading: true, error: null });
      debugLog('[Auth] Signing in...');

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('[Auth] Sign in error:', error);
        set({ error: error.message, isLoading: false });
        return { error };
      }

      debugLog('[Auth] Sign in successful');
      set({
        session: data.session,
        user: data.user,
        isLoading: false,
      });

      // Sync user preferences from database
      if (data.user) {
        useFilterStore.getState().syncWithDatabase(data.user.id);
        useOnboardingStore.getState().loadUserPreferences(data.user.id);
      }

      return { error: null };
    } catch (err) {
      const error = err as AuthError;
      console.error('[Auth] Unexpected sign in error:', error);
      set({ error: error.message, isLoading: false });
      return { error };
    }
  },

  // Sign up with email/password
  signUp: async (email: string, password: string, metadata?: { profile_name?: string }) => {
    try {
      set({ isLoading: true, error: null });
      debugLog('[Auth] Signing up...');

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata,
        },
      });

      if (error) {
        console.error('[Auth] Sign up error:', error);
        set({ error: error.message, isLoading: false });
        return { error, needsEmailVerification: false };
      }

      // Check if email confirmation is required
      const needsEmailVerification = !data.session && !!data.user;

      if (needsEmailVerification) {
        debugLog('[Auth] Sign up successful - email verification required');
        set({ isLoading: false });
      } else {
        debugLog('[Auth] Sign up successful - auto logged in');
        set({
          session: data.session,
          user: data.user,
          isLoading: false,
        });
      }

      return { error: null, needsEmailVerification };
    } catch (err) {
      const error = err as AuthError;
      console.error('[Auth] Unexpected sign up error:', error);
      set({ error: error.message, isLoading: false });
      return { error, needsEmailVerification: false };
    }
  },

  // Sign out
  signOut: async () => {
    try {
      set({ isLoading: true, error: null });
      debugLog('[Auth] Signing out...');

      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error('[Auth] Sign out error:', error);
        set({ error: error.message, isLoading: false });
        return { error };
      }

      debugLog('[Auth] Sign out successful');
      set({
        session: null,
        user: null,
        isLoading: false,
      });

      return { error: null };
    } catch (err) {
      const error = err as AuthError;
      console.error('[Auth] Unexpected sign out error:', error);
      set({ error: error.message, isLoading: false });
      return { error };
    }
  },

  // Send password reset email
  resetPassword: async (email: string) => {
    try {
      set({ isLoading: true, error: null });
      debugLog('[Auth] Sending password reset email...');

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'eatme://reset-password', // Deep link for mobile app
      });

      if (error) {
        console.error('[Auth] Password reset error:', error);
        set({ error: error.message, isLoading: false });
        return { error };
      }

      debugLog('[Auth] Password reset email sent');
      set({ isLoading: false });
      return { error: null };
    } catch (err) {
      const error = err as AuthError;
      console.error('[Auth] Unexpected password reset error:', error);
      set({ error: error.message, isLoading: false });
      return { error };
    }
  },

  // Update password
  updatePassword: async (newPassword: string) => {
    try {
      set({ isLoading: true, error: null });
      debugLog('[Auth] Updating password...');

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        console.error('[Auth] Password update error:', error);
        set({ error: error.message, isLoading: false });
        return { error };
      }

      debugLog('[Auth] Password updated successfully');
      set({ isLoading: false });
      return { error: null };
    } catch (err) {
      const error = err as AuthError;
      console.error('[Auth] Unexpected password update error:', error);
      set({ error: error.message, isLoading: false });
      return { error };
    }
  },

  // Update user profile
  updateProfile: async (data: { profile_name?: string; avatar_url?: string }) => {
    try {
      set({ isLoading: true, error: null });
      debugLog('[Auth] Updating profile...');

      const { error } = await supabase.auth.updateUser({
        data,
      });

      if (error) {
        console.error('[Auth] Profile update error:', error);
        set({ error: error.message, isLoading: false });
        return { error };
      }

      // Refresh user data
      const {
        data: { user },
      } = await supabase.auth.getUser();
      set({ user, isLoading: false });

      debugLog('[Auth] Profile updated successfully');
      return { error: null };
    } catch (err) {
      const error = err as Error;
      console.error('[Auth] Unexpected profile update error:', error);
      set({ error: error.message, isLoading: false });
      return { error };
    }
  },

  // Sign in with OAuth provider
  signInWithOAuth: async (provider: 'google' | 'facebook') => {
    try {
      set({ isLoading: true, error: null });
      debugLog(`[Auth] Starting ${provider} OAuth flow...`);

      const redirectUrl = getOAuthRedirectUrl();

      // Start OAuth flow with Supabase
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true, // We'll handle the browser ourselves
        },
      });

      if (error) {
        console.error(`[Auth] ${provider} OAuth error:`, error);
        set({ error: error.message, isLoading: false });
        return { error };
      }

      if (!data?.url) {
        const error = new Error('No OAuth URL returned from Supabase');
        console.error('[Auth] OAuth error:', error);
        set({ error: error.message, isLoading: false });
        return { error };
      }

      debugLog(`[Auth] Opening ${provider} OAuth URL:`, data.url);

      // Open OAuth URL in system browser
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl, {
        showInRecents: true,
      });

      debugLog('[Auth] Browser result:', result.type);

      if (result.type === 'success' && result.url) {
        // Extract the URL parameters
        const url = new URL(result.url);
        const params = new URLSearchParams(url.hash.substring(1)); // Remove # from hash
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (accessToken && refreshToken) {
          // Set session with the tokens
          const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            console.error('[Auth] Session error:', sessionError);
            set({ error: sessionError.message, isLoading: false });
            return { error: sessionError };
          }

          debugLog(`[Auth] ${provider} OAuth successful`);
          set({
            session: sessionData.session,
            user: sessionData.user,
            isLoading: false,
          });

          // Sync user preferences from database
          if (sessionData.user) {
            useFilterStore.getState().syncWithDatabase(sessionData.user.id);
            useOnboardingStore.getState().loadUserPreferences(sessionData.user.id);
          }

          return { error: null };
        } else {
          const error = new Error('No access token received from OAuth provider');
          console.error('[Auth] OAuth error:', error);
          set({ error: error.message, isLoading: false });
          return { error };
        }
      } else if (result.type === 'cancel') {
        debugLog(`[Auth] ${provider} OAuth cancelled by user`);
        set({ isLoading: false });
        return { error: new Error('OAuth cancelled') };
      } else {
        const error = new Error('OAuth failed');
        console.error('[Auth] OAuth error:', error);
        set({ error: error.message, isLoading: false });
        return { error };
      }
    } catch (err) {
      const error = err as Error;
      console.error('[Auth] Unexpected OAuth error:', error);
      set({ error: error.message, isLoading: false });
      return { error };
    }
  },

  // Clear error
  clearError: () => set({ error: null }),

  // Set session
  setSession: (session: Session | null) =>
    set({
      session,
      user: session?.user ?? null,
    }),
}));

// Selector hooks for common use cases
export const useUser = () => useAuthStore(state => state.user);
export const useSession = () => useAuthStore(state => state.session);
export const useIsAuthenticated = () => useAuthStore(state => !!state.session);
export const useAuthLoading = () => useAuthStore(state => state.isLoading);
export const useAuthError = () => useAuthStore(state => state.error);
