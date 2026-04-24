import Link from 'next/link';
import { verifyAdminSession } from '@/lib/auth/dal';

const navItems = [
  { href: '/restaurants', label: 'Restaurants' },
  { href: '/menu-scan', label: 'Menu Scan' },
  { href: '/imports', label: 'Imports' },
  { href: '/audit', label: 'Audit Log' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await verifyAdminSession();
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r bg-background flex flex-col p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-3">
          EatMe Admin
        </p>
        <nav className="flex-1 space-y-0.5" aria-label="Admin navigation">
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex-1 flex flex-col">
        <header className="h-14 border-b flex items-center px-6">
          <p className="text-sm font-semibold">Admin Portal</p>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
