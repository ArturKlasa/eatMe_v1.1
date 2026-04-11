import { LoadingSkeleton } from '@/components/LoadingSkeleton';

export default function AdminLoading() {
  return <LoadingSkeleton variant="stats" count={4} />;
}
