'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

/**
 * Client-side callback handler for implicit flow (hash-based tokens)
 * This handles the case where Supabase sends tokens in URL fragment (#)
 */

export default function CallbackClientPage() {
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get session from URL hash
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error('[Auth] Error processing callback hash:', error);
          window.location.href = '/auth/login?error=session_failed';
          return;
        }

        const user = data.session?.user;

        if (user) {
          console.log('[Auth] User authenticated via implicit flow:', {
            userId: user.id,
            email: user.email,
            role: user.user_metadata?.role || 'owner',
            timestamp: new Date().toISOString(),
          });

          // Role-based redirect
          const userRole = user.user_metadata?.role;

          if (userRole === 'admin') {
            console.log('[Auth] Redirecting admin to /admin');
            window.location.href = '/admin';
          } else {
            console.log('[Auth] Redirecting owner to /');
            window.location.href = '/';
          }
        } else {
          console.warn('[Auth] No session after callback');
          window.location.href = '/auth/login';
        }
      } catch (error) {
        console.error('[Auth] Callback error:', error);
        window.location.href = '/auth/login?error=callback_error';
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-orange-600" />
        <p className="mt-2 text-gray-600">Setting up your session...</p>
        <p className="mt-1 text-xs text-gray-500">Please wait...</p>
      </div>
    </div>
  );
}
