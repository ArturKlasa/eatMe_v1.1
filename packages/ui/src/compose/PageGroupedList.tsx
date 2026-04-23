import type { ReactNode } from 'react';

export interface PageGroupedListGroup {
  id: string;
  title: string;
  meta?: ReactNode;
  headerAction?: ReactNode;
  children: ReactNode;
}

export interface PageGroupedListProps {
  groups: PageGroupedListGroup[];
  emptyState?: ReactNode;
  className?: string;
}

export function PageGroupedList({ groups, emptyState, className }: PageGroupedListProps) {
  if (groups.length === 0 && emptyState) {
    return <div className={className}>{emptyState}</div>;
  }

  return (
    <div className={className}>
      {groups.map(group => (
        <section key={group.id} className="mb-8">
          <div className="flex items-center justify-between border-b border-border pb-2 mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold">{group.title}</h2>
              {group.meta && <span className="text-sm text-muted-foreground">{group.meta}</span>}
            </div>
            {group.headerAction && <div>{group.headerAction}</div>}
          </div>
          {group.children}
        </section>
      ))}
    </div>
  );
}
