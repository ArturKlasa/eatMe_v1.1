'use client';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export type StatusVariant = 'active' | 'inactive' | 'pending' | 'error' | 'warning' | 'draft';

interface StatusBadgeProps {
  variant: StatusVariant;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

const STATUS_CONFIG: Record<StatusVariant, { label: string; dotClass: string; className: string }> = {
  active:   { label: 'Active',   dotClass: 'bg-success',             className: 'bg-success/10 text-success border-success/20' },
  inactive: { label: 'Inactive', dotClass: 'bg-muted-foreground',    className: 'bg-muted text-muted-foreground border-border' },
  pending:  { label: 'Pending',  dotClass: 'bg-warning',             className: 'bg-warning/10 text-warning border-warning/20' },
  error:    { label: 'Error',    dotClass: 'bg-destructive',         className: 'bg-destructive/10 text-destructive border-destructive/20' },
  warning:  { label: 'Warning',  dotClass: 'bg-warning',             className: 'bg-warning/10 text-warning border-warning/20' },
  draft:    { label: 'Draft',    dotClass: 'bg-muted-foreground',    className: 'bg-muted text-muted-foreground border-border' },
};

export function StatusBadge({ variant, label, size = 'md', className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[variant];
  const displayLabel = label ?? config.label;

  return (
    <Badge
      size={size}
      className={cn(config.className, className)}
    >
      <span className={cn('rounded-full shrink-0', config.dotClass, size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2')} />
      {displayLabel}
    </Badge>
  );
}
