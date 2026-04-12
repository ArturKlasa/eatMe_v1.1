'use client';

import { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { AdminRoute } from '@/components/AdminRoute';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  return (
    <AdminRoute>
      <div className="min-h-screen bg-muted/30">
        {/* Admin Header */}
        <AdminHeader user={user!} />

        <div className="flex">
          {/* Sidebar Navigation */}
          <AdminSidebar />

          {/* Main Content */}
          <main className="flex-1 p-8">
            {/* SECURITY: Add visual indicator that this is admin area */}
            <div className="sticky top-0 z-10 mb-4 p-2 bg-destructive/10 border border-destructive/20 rounded text-xs text-destructive">
              🔒 <strong>Admin Mode</strong> - All actions are logged and monitored
            </div>

            {children}
          </main>
        </div>
      </div>
    </AdminRoute>
  );
}
