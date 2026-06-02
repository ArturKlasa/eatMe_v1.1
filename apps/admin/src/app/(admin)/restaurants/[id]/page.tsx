import { notFound } from 'next/navigation';
import Link from 'next/link';
import { countryToLanguage } from '@eatme/shared';
import { verifyAdminSession } from '@/lib/auth/dal';
import {
  getAdminRestaurantById,
  getAdminRestaurantMenus,
  getAllDishCategoryOptions,
  getCanonicalMenuCategoryOptions,
} from '@/lib/auth/dal';
import { createAdminServiceClient } from '@/lib/supabase/server';
import { AdminSuspensionSection } from './AdminSuspensionSection';
import { LocationCurrencySection } from './LocationCurrencySection';
import { MenusSection } from './MenusSection';
import { OpeningHoursSection } from './OpeningHoursSection';
import { PublishSection } from './PublishSection';
import { RestaurantInspector } from './RestaurantInspector';
import { ScanNewMenuSection } from './ScanNewMenuSection';

async function getDraftCounts(restaurantId: string): Promise<{ menus: number; dishes: number }> {
  const service = createAdminServiceClient();
  const [menusRes, dishesRes] = await Promise.all([
    service
      .from('menus')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
      .eq('status', 'draft'),
    service
      .from('dishes')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
      .eq('status', 'draft'),
  ]);
  return { menus: menusRes.count ?? 0, dishes: dishesRes.count ?? 0 };
}

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

  const [draftCounts, menusData, dishCategoryOptions, canonicalCategoryOptions] = await Promise.all(
    [
      getDraftCounts(restaurant.id),
      getAdminRestaurantMenus(restaurant.id),
      getAllDishCategoryOptions(),
      getCanonicalMenuCategoryOptions(),
    ]
  );

  // Source language for new menu_categories defaults to the country-derived
  // language (matches how the menu-scan flow derives sourceLanguage).
  const sourceLanguageCode = countryToLanguage(restaurant.country_code);

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

      {/* Country + currency — editable inline. Drives all price-input
          rendering downstream (DishRowEditor, AddDishButton, ModifierGroupsEditor,
          ReviewDishEditor). */}
      <LocationCurrencySection
        restaurantId={restaurant.id}
        restaurantName={restaurant.name}
        countryCode={restaurant.country_code}
        currencyCode={restaurant.currency_code}
      />

      {/* Opening hours — editable inline */}
      <OpeningHoursSection restaurantId={restaurant.id} openHours={restaurant.open_hours} />

      {/* Publication / draft → published flow */}
      <PublishSection
        restaurantId={restaurant.id}
        status={restaurant.status}
        draftMenusCount={draftCounts.menus}
        draftDishesCount={draftCounts.dishes}
      />

      {/* Menu hierarchy (read-only verifier view) */}
      <MenusSection
        restaurantId={restaurant.id}
        menus={menusData.menus}
        uncategorizedDishes={menusData.uncategorizedDishes}
        dishCategoryOptions={dishCategoryOptions}
        canonicalCategoryOptions={canonicalCategoryOptions}
        sourceLanguageCode={sourceLanguageCode}
        currencyCode={restaurant.currency_code}
      />

      {/* Scan additional menu — drafts will land in this restaurant's menu */}
      <ScanNewMenuSection restaurantId={restaurant.id} restaurantName={restaurant.name} />

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
