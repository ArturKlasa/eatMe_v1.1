import { notFound } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { verifyAdminSession } from '@/lib/auth/dal';
import { getAdminRestaurantById } from '@/lib/auth/dal';
import { AdminSuspensionSection } from './AdminSuspensionSection';

const RestaurantInspector = dynamic(
  () => import('./RestaurantInspector').then(m => m.RestaurantInspector),
  { ssr: false }
);

interface Props {
  params: Promise<{ id: string }>;
}

function statusBadgeClass(status: string) {
  if (status === 'published') return 'bg-green-100 text-green-800';
  if (status === 'draft') return 'bg-yellow-100 text-yellow-800';
  return 'bg-gray-100 text-gray-600';
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="w-32 shrink-0 text-muted-foreground">{label}</span>
      <span className="text-foreground">{value ?? '—'}</span>
    </div>
  );
}

export default async function AdminRestaurantDetailPage({ params }: Props) {
  await verifyAdminSession();
  const { id } = await params;
  const restaurant = await getAdminRestaurantById(id);
  if (!restaurant) notFound();

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/restaurants" className="text-sm text-muted-foreground hover:text-foreground">
          ← Restaurants
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4">
        <h1 className="text-xl font-semibold">{restaurant.name}</h1>
        <div className="flex gap-2 shrink-0">
          <span
            className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${statusBadgeClass(restaurant.status)}`}
          >
            {restaurant.status}
          </span>
          {!restaurant.is_active && (
            <span className="inline-block rounded px-2 py-0.5 text-xs font-medium bg-red-100 text-destructive">
              Suspended
            </span>
          )}
        </div>
      </div>

      {/* Basic info card (read-only) */}
      <section className="rounded-lg border border-border p-4 space-y-2">
        <h2 className="font-semibold text-sm mb-3">Basic info</h2>
        <InfoRow label="ID" value={restaurant.id} />
        <InfoRow label="Owner" value={restaurant.owner_id} />
        <InfoRow label="Address" value={restaurant.address} />
        <InfoRow label="City" value={restaurant.city} />
        <InfoRow label="Phone" value={restaurant.phone} />
        <InfoRow label="Website" value={restaurant.website} />
        <InfoRow label="Type" value={restaurant.restaurant_type} />
        <InfoRow label="Cuisines" value={restaurant.cuisine_types?.join(', ') ?? null} />
        <InfoRow
          label="Created"
          value={restaurant.created_at ? new Date(restaurant.created_at).toLocaleString() : null}
        />
      </section>

      {/* Admin-only suspension section */}
      <AdminSuspensionSection
        restaurantId={restaurant.id}
        isActive={restaurant.is_active}
        suspendedAt={restaurant.suspended_at}
        suspendedBy={restaurant.suspended_by}
        suspensionReason={restaurant.suspension_reason}
      />

      {/* Raw DB inspector (dynamic, client-only) */}
      <RestaurantInspector data={restaurant as Record<string, unknown>} />
    </div>
  );
}
