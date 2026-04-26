'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardList, FileSpreadsheet, ScanLine, Store, type LucideIcon } from 'lucide-react';
import { cn } from '@eatme/ui';

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const navItems: NavItem[] = [
  { href: '/restaurants', label: 'Restaurants', icon: Store },
  { href: '/menu-scan', label: 'Menu Scan', icon: ScanLine },
  { href: '/imports', label: 'Imports', icon: FileSpreadsheet },
  { href: '/audit', label: 'Audit Log', icon: ClipboardList },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex-1 space-y-0.5" aria-label="Admin navigation">
      {navItems.map(item => {
        const Icon = item.icon;
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
