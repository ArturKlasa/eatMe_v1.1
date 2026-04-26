import Link from 'next/link';
import { ClipboardList, FileSpreadsheet, ScanLine, Store, type LucideIcon } from 'lucide-react';

type QuickLink = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

const quickLinks: QuickLink[] = [
  {
    href: '/restaurants',
    label: 'Restaurants',
    description: 'Browse, inspect, and suspend restaurants on the platform.',
    icon: Store,
  },
  {
    href: '/menu-scan',
    label: 'Menu Scan',
    description: 'Run AI-powered menu extraction jobs and inspect raw output.',
    icon: ScanLine,
  },
  {
    href: '/imports',
    label: 'Imports',
    description: 'Bulk-import restaurants from CSV or Google Places.',
    icon: FileSpreadsheet,
  },
  {
    href: '/audit',
    label: 'Audit Log',
    description: 'Review recent admin actions across the platform.',
    icon: ClipboardList,
  },
];

export default function AdminDashboardPage() {
  return (
    <div className="max-w-5xl space-y-8">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Internal tools for managing the EatMe platform.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {quickLinks.map(({ href, label, description, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group rounded-lg border bg-card p-5 transition-colors hover:border-foreground/20 hover:bg-accent/40"
          >
            <div className="flex items-start gap-3">
              <div className="rounded-md border bg-background p-2 group-hover:border-foreground/20">
                <Icon className="size-4 text-foreground" aria-hidden="true" />
              </div>
              <div className="space-y-1 min-w-0">
                <p className="font-medium leading-none">{label}</p>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
