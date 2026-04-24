import { getAdminRestaurants } from '@/lib/auth/dal';
import { RestaurantsTable } from './RestaurantsTable';

interface Props {
  searchParams: Promise<{
    q?: string;
    status?: string;
    is_active?: string;
    city?: string;
    page?: string;
  }>;
}

export default async function AdminRestaurantsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? '1') || 1);
  const is_active = sp.is_active === 'true' ? true : sp.is_active === 'false' ? false : undefined;

  const { rows, total } = await getAdminRestaurants({
    search: sp.q,
    status: sp.status,
    is_active,
    city: sp.city,
    page,
    limit: 50,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Restaurants</h1>
        <p className="text-sm text-muted-foreground">{total} total</p>
      </div>
      <RestaurantsTable
        rows={rows}
        total={total}
        page={page}
        filters={{
          q: sp.q ?? '',
          status: sp.status ?? '',
          is_active: sp.is_active ?? '',
          city: sp.city ?? '',
        }}
      />
    </div>
  );
}
