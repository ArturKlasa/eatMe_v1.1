import { Skeleton } from '@/components/ui/skeleton';

interface LoadingSkeletonProps {
  variant: 'card' | 'table' | 'form' | 'stats' | 'page';
  count?: number;
}

function CardSkeleton() {
  return (
    <div className="rounded-lg border p-card space-y-3">
      <Skeleton className="h-5 w-2/5" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
    </div>
  );
}

function TableSkeleton({ count = 5 }: { count: number }) {
  return (
    <div className="rounded-lg border">
      <div className="border-b p-card-compact flex gap-4">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/6" />
      </div>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="border-b last:border-b-0 p-card-compact flex gap-4">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/6" />
        </div>
      ))}
    </div>
  );
}

function FormSkeleton({ count = 4 }: { count: number }) {
  return (
    <div className="space-y-section">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="rounded-lg border p-card space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-8 w-1/2" />
        </div>
      ))}
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-section">
      <div className="space-y-2">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div className="rounded-lg border p-card space-y-4">
        <Skeleton className="h-5 w-2/5" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}

export function LoadingSkeleton({ variant, count }: LoadingSkeletonProps) {
  switch (variant) {
    case 'card': {
      const n = count ?? 1;
      return (
        <div className="space-y-4">
          {Array.from({ length: n }, (_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      );
    }
    case 'table':
      return <TableSkeleton count={count ?? 5} />;
    case 'form':
      return <FormSkeleton count={count ?? 4} />;
    case 'stats':
      return <StatsSkeleton />;
    case 'page':
      return <PageSkeleton />;
  }
}
