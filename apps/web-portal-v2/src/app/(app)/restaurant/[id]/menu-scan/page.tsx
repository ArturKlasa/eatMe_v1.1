import Link from 'next/link';
import { notFound } from 'next/navigation';
import { verifySession, getRestaurant, getMenuScanJobs } from '@/lib/auth/dal';
import { MenuScanUploadForm } from './MenuScanUploadForm';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function MenuScanPage({ params }: Props) {
  const { id } = await params;
  const { userId } = await verifySession();
  const restaurant = await getRestaurant(id, userId);
  if (!restaurant) notFound();

  const jobs = (await getMenuScanJobs(id, userId)) ?? [];

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-8">
      <div>
        <Link
          href={`/restaurant/${id}`}
          className="text-sm text-muted-foreground hover:underline mb-1 block"
        >
          ← {restaurant.name}
        </Link>
        <h1 className="text-xl font-semibold">Menu Scan</h1>
      </div>

      <MenuScanUploadForm restaurantId={id} />

      {jobs.length > 0 && (
        <section aria-label="Previous scans">
          <h2 className="text-base font-medium mb-3">Previous scans</h2>
          <ul className="space-y-2">
            {jobs.map(job => (
              <li
                key={job.id}
                className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm"
              >
                <span className="text-muted-foreground">
                  {new Date(job.created_at as string).toLocaleString()}
                </span>
                <div className="flex items-center gap-3">
                  <span className="capitalize font-medium">
                    {(job.status as string).replace(/_/g, ' ')}
                  </span>
                  {(job.status === 'needs_review' || job.status === 'completed') && (
                    <Link
                      href={`/restaurant/${id}/menu-scan/${job.id}`}
                      className="text-primary text-xs hover:underline"
                    >
                      Review →
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
