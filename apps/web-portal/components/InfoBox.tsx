'use client';

import { ReactNode } from 'react';
import { Info, AlertTriangle, CheckCircle2, XCircle, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';

export type InfoBoxVariant = 'info' | 'warning' | 'success' | 'error' | 'tip';

interface InfoBoxProps {
  variant?: InfoBoxVariant;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

const VARIANT_CONFIG: Record<InfoBoxVariant, { icon: ReactNode; surfaceClass: string; textClass: string }> = {
  info:    { icon: <Info className="h-4 w-4" />,          surfaceClass: 'surface-info',    textClass: 'text-info' },
  warning: { icon: <AlertTriangle className="h-4 w-4" />, surfaceClass: 'surface-warning', textClass: 'text-warning' },
  success: { icon: <CheckCircle2 className="h-4 w-4" />,  surfaceClass: 'surface-success', textClass: 'text-success' },
  error:   { icon: <XCircle className="h-4 w-4" />,       surfaceClass: 'surface-error',   textClass: 'text-destructive' },
  tip:     { icon: <Lightbulb className="h-4 w-4" />,     surfaceClass: 'surface-info',    textClass: 'text-info' },
};

export function InfoBox({ variant = 'info', icon, children, className }: InfoBoxProps) {
  const config = VARIANT_CONFIG[variant];
  const renderedIcon = icon ?? config.icon;

  return (
    <div className={cn(config.surfaceClass, 'flex items-start gap-3 p-3 text-sm', className)}>
      <span className={cn('mt-0.5 shrink-0', config.textClass)}>{renderedIcon}</span>
      <div className="text-foreground">{children}</div>
    </div>
  );
}
