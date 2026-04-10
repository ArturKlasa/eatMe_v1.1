import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderBadge {
  label: string;
  variant: 'default' | 'success' | 'warning' | 'destructive';
}

interface PageHeaderProps {
  title: string;
  description?: string;
  backHref?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  badge?: PageHeaderBadge;
}

const BADGE_VARIANT_MAP: Record<PageHeaderBadge['variant'], string> = {
  default: '',
  success: 'bg-green-100 text-green-800 border-green-200',
  warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  destructive: 'bg-red-100 text-red-800 border-red-200',
};

export function PageHeader({
  title,
  description,
  backHref,
  breadcrumbs,
  actions,
  badge,
}: PageHeaderProps) {
  return (
    <div className="mb-section space-y-2">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1 text-sm text-muted-foreground"
        >
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <span aria-hidden="true">/</span>}
              {crumb.href ? (
                <Link href={crumb.href} className="hover:text-foreground transition-colors">
                  {crumb.label}
                </Link>
              ) : (
                <span>{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {backHref && (
            <Link
              href={backHref}
              className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="size-5" />
            </Link>
          )}
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            {badge && (
              <Badge
                className={
                  badge.variant !== 'default' ? BADGE_VARIANT_MAP[badge.variant] : undefined
                }
              >
                {badge.label}
              </Badge>
            )}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}
