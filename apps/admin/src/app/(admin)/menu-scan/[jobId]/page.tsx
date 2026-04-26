import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  verifyAdminSession,
  getAdminMenuScanJobById,
  getMenuScanReviewContext,
} from '@/lib/auth/dal';
import { AdminJobShell } from './AdminJobShell';

export default async function MenuScanJobPage({ params }: { params: Promise<{ jobId: string }> }) {
  await verifyAdminSession();

  const { jobId } = await params;
  const job = await getAdminMenuScanJobById(jobId);

  if (!job) notFound();

  // Only the review UI needs the category context — skip the fetch otherwise
  // (avoids two extra queries on completed/failed/processing jobs).
  const reviewContext =
    job.status === 'needs_review' ? await getMenuScanReviewContext(job.restaurant_id) : null;

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

      <AdminJobShell job={job} reviewContext={reviewContext} />
    </div>
  );
}
