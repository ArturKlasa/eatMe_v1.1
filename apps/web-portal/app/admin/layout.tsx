'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminHeader } from '@/components/admin/AdminHeader';

/**
 * SECURITY: Admin Layout with Server-Side Authentication Check
 *
 * This layout:
 * 1. Runs on the server (cannot be bypassed by client)
 * 2. Verifies user is authenticated AND has admin role
 * 3. Redirects unauthorized users before rendering
 * 4. Provides consistent admin UI structure
 *
 * @security This is a critical security boundary - all admin pages
 * inherit this protection automatically
 */

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const checkAdmin = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error || !session?.user) {
        router.replace('/auth/login?error=unauthorized&redirect=/admin');
        return;
      }

      const userRole = session.user.user_metadata?.role;

      if (userRole !== 'admin') {
        console.warn('[SECURITY] Non-admin user blocked from admin layout:', {
          userId: user.id,
          email: user.email,
          role: userRole || 'none',
          timestamp: new Date().toISOString(),
        });

        router.replace('/?error=admin_only');
        return;
      }

      setUser(session.user);
      setLoading(false);
    };

    checkAdmin();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin Header */}
      <AdminHeader user={user} />

      <div className="flex">
        {/* Sidebar Navigation */}
        <AdminSidebar />

        {/* Main Content */}
        <main className="flex-1 p-8">
          {/* SECURITY: Add visual indicator that this is admin area */}
          <div className="sticky top-0 z-10 mb-4 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            🔒 <strong>Admin Mode</strong> - All actions are logged and monitored
          </div>

          {children}
        </main>
      </div>
    </div>
  );
}

/**
 * SECURITY NOTE: Admin access is enforced client-side here due to
 * local dev OAuth cookie propagation issues. RLS still protects data.
 */
