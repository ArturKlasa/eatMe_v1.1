'use client';

import { LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';

/**
 * Header for restaurant owner pages.
 * Renders null for unauthenticated users and for admin users (they have their own header).
 */
export function OwnerHeader() {
  const { user, signOut } = useAuth();

  if (!user || user.user_metadata?.role === 'admin') {
    return null;
  }

  return (
    <header className="bg-background border-b border sticky top-0 z-50">
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-foreground">🍽️ EatMe</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" size="sm" onClick={signOut} className="flex items-center gap-2">
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
