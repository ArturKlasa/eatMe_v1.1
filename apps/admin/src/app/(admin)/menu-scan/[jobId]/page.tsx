import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  verifyAdminSession,
  getAdminMenuScanJobById,
  getMenuScanReviewContext,
  fuzzyMatchDishCategories,
  type DishCategoryMatch,
} from '@/lib/auth/dal';
import { AdminJobShell } from './AdminJobShell';

export default async function MenuScanJobPage({ params }: { params: Promise<{ jobId: string }> }) {
  await verifyAdminSession();

  const { jobId } = await params;
  const job = await getAdminMenuScanJobById(jobId);

  if (!job) notFound();

  // Only the review UI needs the category context — skip the fetch otherwise
  // (avoids extra queries on completed/failed/processing jobs).
  let reviewContext = null;
  let dishCategoryMatches: DishCategoryMatch[] = [];

  if (job.status === 'needs_review') {
    reviewContext = await getMenuScanReviewContext(job.restaurant_id);

    // Fuzzy-resolve every unique suggested_dish_category string to a real
    // dish_categories row. Done server-side at page load so the client gets
    // pre-resolved matches and renders synchronously.
    const result = job.result_json as {
      dishes?: Array<{ suggested_dish_category?: string | null }>;
    } | null;
    const queries = (result?.dishes ?? [])
      .map(d => d.suggested_dish_category ?? null)
      .filter((q): q is string => !!q && q.trim().length > 0);
    if (queries.length > 0) {
      dishCategoryMatches = await fuzzyMatchDishCategories(queries);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">Menu Scan Job</h1>
          <p className="text-xs font-mono text-muted-foreground mt-1">{job.id}</p>
        </div>
        <Link href="/menu-scan" className="text-sm text-primary hover:underline">
          ← All jobs
        </Link>
      </div>

      <AdminJobShell
        job={job}
        reviewContext={reviewContext}
        dishCategoryMatches={dishCategoryMatches}
      />
    </div>
  );
}
