'use client';

import { User } from '@supabase/supabase-js';
import { LogOut, Shield } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface AdminHeaderProps {
  user: User;
}

/**
 * SECURITY: Admin Header Component
 *
 * Displays:
 * - Admin user info
 * - Security indicator
 * - Logout button
 */

export function AdminHeader({ user }: AdminHeaderProps) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) throw error;

      // SECURITY LOG: Admin logout
      console.log('[Auth] Admin logged out:', {
        userId: user.id,
        email: user.email,
        timestamp: new Date().toISOString(),
      });

      toast.success('Logged out successfully');
      router.push('/auth/login');
      router.refresh();
    } catch (error) {
      console.error('[Auth] Logout error:', error);
      toast.error('Failed to log out');
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="flex items-center justify-between px-6 py-3">
        {/* Left: Logo and Title */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1 bg-red-50 border border-red-200 rounded-full">
            <Shield className="h-4 w-4 text-red-600" />
            <span className="text-sm font-semibold text-red-700">ADMIN</span>
          </div>
          <h1 className="text-xl font-bold text-gray-800">EatMe Admin Dashboard</h1>
        </div>

        {/* Right: User Info and Logout */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-medium text-gray-700">{user.email}</p>
            <p className="text-xs text-gray-500">Administrator</p>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
