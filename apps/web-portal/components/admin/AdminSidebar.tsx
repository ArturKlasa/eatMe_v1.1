'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Store,
  FileText,
  Shield,
  Leaf,
  Sprout,
  Tag,
  ScanLine,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard, exact: true },
  {
    name: 'Restaurants',
    href: '/admin/restaurants',
    icon: Store,
    exclude: '/admin/restaurants/import',
  },
  { name: 'Import', href: '/admin/restaurants/import', icon: Download },
  {
    name: 'Ingredients',
    href: '/admin/ingredients',
    icon: Leaf,
    exclude: '/admin/ingredients/review',
  },
  { name: 'Ingredient Review', href: '/admin/ingredients/review', icon: Sprout },
  { name: 'Dish Categories', href: '/admin/dish-categories', icon: Tag },
  { name: 'Menu Scan', href: '/admin/menu-scan', icon: ScanLine },
  { name: 'Audit Logs', href: '/admin/audit', icon: FileText },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-64 bg-background border-r border min-h-[calc(100vh-57px)] flex-col">
      <nav className="p-4 space-y-2 flex-1 overflow-y-auto">
        {/* Security notice — warning colors applied directly (surface-warning utility added in Step 6) */}
        <div className="mb-6 flex items-center gap-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800">
          <Shield className="h-4 w-4 text-yellow-600 flex-shrink-0" />
          <span>All actions are logged</span>
        </div>

        {/* Navigation Links */}
        {navigation.map(item => {
          const isActive = item.exact
            ? pathname === item.href
            : (pathname === item.href || pathname.startsWith(`${item.href}/`)) &&
              (!item.exclude || !pathname.startsWith(item.exclude));
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                isActive
                  ? 'bg-brand-primary/10 text-brand-primary font-medium'
                  : 'text-foreground hover:bg-accent'
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border bg-muted/30">
        <div className="p-3 bg-background rounded-lg text-xs text-muted-foreground">
          <p className="font-semibold mb-1">Need Help?</p>
          <p>
            See{' '}
            <Link href="/docs/ADMIN_SECURITY.md" className="text-brand-primary hover:underline">
              Security Docs
            </Link>
          </p>
        </div>
      </div>
    </aside>
  );
}
