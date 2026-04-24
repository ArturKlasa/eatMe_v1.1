import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  verifySession,
  getRestaurant,
  getMenuScanJob,
  getRestaurantMenuCategories,
} from '@/lib/auth/dal';
import { ScanReviewShell } from './ScanReviewShell';

interface Props {
  params: Promise<{ id: string; jobId: string }>;
}

export default async function MenuScanJobPage({ params }: Props) {
  const { id, jobId } = await params;
  const { userId } = await verifySession();

  const [restaurant, job, menuData] = await Promise.all([
    getRestaurant(id, userId),
    getMenuScanJob(jobId, userId),
    getRestaurantMenuCategories(id, userId),
  ]);

  if (!restaurant || !job) notFound();

  const raw = menuData ?? { menus: [], categories: [] };
  const menus = raw.menus;
  const categories = raw.categories.filter(
    (c): c is typeof c & { menu_id: string } => c.menu_id !== null
  );

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-6">
      <div>
        <Link
          href={`/restaurant/${id}/menu-scan`}
          className="text-sm text-muted-foreground hover:underline mb-1 block"
        >
          ← Menu Scan
        </Link>
        <h1 className="text-xl font-semibold">Review Scan</h1>
      </div>

      <ScanReviewShell
        jobId={jobId}
        restaurantId={id}
        initial={job}
        categories={categories}
        menus={menus}
      />
    </div>
  );
}
