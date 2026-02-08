'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Store,
  FileText,
  Users,
  Settings,
  AlertTriangle,
  Leaf,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * SECURITY: Admin Sidebar Navigation
 *
 * Features:
 * - Visual indication of current page
 * - Clear navigation structure
 * - Security indicator
 */

const navigation = [
  {
    name: 'Dashboard',
    href: '/admin',
    icon: LayoutDashboard,
  },
  {
    name: 'Restaurants',
    href: '/admin/restaurants',
    icon: Store,
  },
  {
    name: 'Ingredients',
    href: '/admin/ingredients',
    icon: Leaf,
  },
  {
    name: 'Audit Logs',
    href: '/admin/audit',
    icon: FileText,
  },
  {
    name: 'Users',
    href: '/admin/users',
    icon: Users,
    badge: 'Coming Soon',
  },
  {
    name: 'Settings',
    href: '/admin/settings',
    icon: Settings,
    badge: 'Coming Soon',
  },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-white border-r border-gray-200 min-h-[calc(100vh-57px)] flex flex-col">
      <nav className="p-4 space-y-2 flex-1 overflow-y-auto">
        {/* Security Warning */}
        <div className="mb-6 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-yellow-800">
              <p className="font-semibold mb-1">Security Notice</p>
              <p>All admin actions are logged and monitored for security purposes.</p>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        {navigation.map(item => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                isActive
                  ? 'bg-orange-50 text-orange-600 font-medium'
                  : 'text-gray-700 hover:bg-gray-50',
                item.badge && 'opacity-50 cursor-not-allowed'
              )}
              onClick={e => item.badge && e.preventDefault()}
            >
              <Icon className="h-5 w-5" />
              <span>{item.name}</span>
              {item.badge && (
                <span className="ml-auto text-[10px] px-2 py-0.5 bg-gray-200 text-gray-600 rounded-full">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="p-3 bg-white rounded-lg text-xs text-gray-600">
          <p className="font-semibold mb-1">Need Help?</p>
          <p>
            See{' '}
            <Link href="/docs/ADMIN_SECURITY.md" className="text-orange-600 hover:underline">
              Security Docs
            </Link>
          </p>
        </div>
      </div>
    </aside>
  );
}
