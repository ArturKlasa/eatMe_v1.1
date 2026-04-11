'use client';

import { ReactNode, useState } from 'react';
import { Collapsible } from 'radix-ui';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface SectionCardProps {
  title: string;
  icon?: ReactNode;
  description?: string;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function SectionCard({
  title,
  icon,
  description,
  collapsible = false,
  defaultExpanded = true,
  children,
  action,
  className,
}: SectionCardProps) {
  const [open, setOpen] = useState(defaultExpanded);

  if (!collapsible) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              {icon}
              {title}
            </CardTitle>
            {action}
          </div>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    );
  }

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen}>
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              {icon}
              {title}
            </CardTitle>
            <div className="flex items-center gap-2">
              {action}
              <Collapsible.Trigger asChild>
                <button
                  className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground"
                  aria-label={open ? 'Collapse section' : 'Expand section'}
                >
                  {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </Collapsible.Trigger>
            </div>
          </div>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <Collapsible.Content
          className={cn(
            'overflow-hidden',
            'data-[state=open]:animate-enter',
          )}
        >
          <CardContent>{children}</CardContent>
        </Collapsible.Content>
      </Card>
    </Collapsible.Root>
  );
}
