'use client';

/**
 * Authentication context for the web portal.
 *
 * Wraps the entire app so every page can access the current Supabase session
 * via the `useAuth()` hook without prop-drilling.
 *
 * Session lifecycle:
 *  1. `onAuthStateChange` fires with `INITIAL_SESSION` on mount, hydrating
 *     state from cookies (covers hard-refreshes and fresh logins in one place).
 *  2. Subsequent events (`SIGNED_IN`, `TOKEN_REFRESHED`, `SIGNED_OUT`) keep
 *     state in sync automatically.
 *  3. Stale form drafts (>7 days) are cleared once per mount when the initial
 *     session is confirmed via the `INITIAL_SESSION` event.
 *
 * Usage:
 *   const { user, signIn, signOut } = useAuth();
 */

import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { clearIfStale } from '@/lib/storage';

/** Shape of the value exposed by AuthContext / useAuth(). */
interface AuthContextType {
  /** Currently authenticated Supabase user, or null if not signed in. */
  user: User | null;
  /** Active Supabase session including access/refresh tokens, or null. */
  session: Session | null;
  /** True while the initial session check is in flight (prevents flash of unauthenticated UI). */
  loading: boolean;
  /**
   * Register a new restaurant partner account.
   * Stores `restaurantName` in Supabase user_metadata so the dashboard can
   * display it before the partner completes onboarding.
   * Returns `needsEmailVerification: true` when email confirmation is required
   * (Supabase "Confirm email" ON), false when the user is auto-logged in.
   */
  signUp: (
    email: string,
    password: string,
    restaurantName: string
  ) => Promise<{ error: Error | null; needsEmailVerification: boolean }>;
  /** Sign in with email and password using Supabase password auth. */
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  /**
   * Initiate OAuth sign-in via Google or Facebook.
   * Uses PKCE flow — Supabase redirects to `/auth/callback` with a `code`
   * parameter that the Route Handler exchanges for a session cookie.
   */
  signInWithOAuth: (provider: 'google' | 'facebook') => Promise<{ error: Error | null }>;
  /** Sign out the current user and clear their local form draft. */
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      // Clear stale drafts once per mount — covers hard-refresh AND fresh logins
      if (event === 'INITIAL_SESSION' && session?.user?.id) {
        clearIfStale(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, restaurantName: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { restaurant_name: restaurantName },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        console.error('Supabase Auth signup error:', error);
        return { error, needsEmailVerification: false };
      }

      return { error: null, needsEmailVerification: !data.session && !!data.user };
    } catch (error) {
      console.error('Signup error:', error);
      return { error: error as Error, needsEmailVerification: false };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signInWithOAuth = async (provider: 'google' | 'facebook') => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          // PKCE flow: Supabase sends ?code= to this URL; the Route Handler
          // at app/auth/callback/route.ts exchanges it for a cookie session.
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;

      return { error: null };
    } catch (error) {
      console.error('[OAuth] Exception:', error);
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    // Clear user-specific draft data before signing out
    if (user?.id) {
      try {
        localStorage.removeItem(`eatme_draft_${user.id}`);
      } catch (err) {
        console.error('Failed to clear draft data:', err);
      }
    }

    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{ user, session, loading, signUp, signIn, signInWithOAuth, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
