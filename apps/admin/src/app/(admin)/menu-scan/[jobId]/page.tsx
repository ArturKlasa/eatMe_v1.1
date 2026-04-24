import { notFound } from 'next/navigation';
import { verifyAdminSession, getAdminMenuScanJobById } from '@/lib/auth/dal';
import { AdminJobShell } from './AdminJobShell';

export default async function MenuScanJobPage({ params }: { params: Promise<{ jobId: string }> }) {
  await verifyAdminSession();

  const { jobId } = await params;
  const job = await getAdminMenuScanJobById(jobId);

  if (!job) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">Menu Scan Job</h1>
          <p className="text-xs font-mono text-muted-foreground mt-1">{job.id}</p>
        </div>
        <a href="/menu-scan" className="text-sm text-primary hover:underline">
          ← All jobs
        </a>
      </div>

      <AdminJobShell job={job} />
    </div>
  );
}
