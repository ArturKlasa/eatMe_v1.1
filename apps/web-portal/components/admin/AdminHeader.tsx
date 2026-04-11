'use client';

import { User } from '@supabase/supabase-js';
import { LogOut, Menu, Shield } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { ThemeToggle } from '@/components/ThemeToggle';
import { InfoBox } from '@/components/InfoBox';
import { AdminSidebar } from '@/components/admin/AdminSidebar';

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    <>
      <header className="bg-background border-b border sticky top-0 z-50">
        <div className="flex items-center justify-between px-6 py-3">
          {/* Left: Hamburger (mobile) + Logo and Title */}
          <div className="flex items-center gap-3">
            <button
              data-testid="mobile-menu-button"
              className="md:hidden flex items-center justify-center p-2 rounded-lg hover:bg-accent transition-colors"
              onClick={() => setMobileMenuOpen(o => !o)}
              aria-label="Toggle navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            {/* Admin security badge */}
            <InfoBox variant="error" icon={<Shield className="h-4 w-4" />} className="rounded-full py-1 px-3 inline-flex items-center">
              <span className="font-semibold">ADMIN</span>
            </InfoBox>
            <h1 className="text-xl font-bold text-foreground hidden sm:block">EatMe Admin Dashboard</h1>
          </div>

          {/* Right: User Info, Theme Toggle and Logout */}
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-foreground">{user.email}</p>
              <p className="text-xs text-muted-foreground">Administrator</p>
            </div>

            <ThemeToggle />

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-accent rounded-lg transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile sidebar drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-50 flex flex-col w-64 bg-background shadow-xl">
            <AdminSidebar />
          </div>
        </div>
      )}
    </>
  );
}
