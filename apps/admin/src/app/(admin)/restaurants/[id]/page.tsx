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
import { BasicInfoSection } from './BasicInfoSection';
import { CopyMenuSection } from './CopyMenuSection';
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

      {/* Basic info card — editable inline (operator issue #14) */}
      <BasicInfoSection
        restaurantId={restaurant.id}
        name={restaurant.name}
        description={restaurant.description}
        address={restaurant.address}
        city={restaurant.city}
        phone={restaurant.phone}
        website={restaurant.website}
        ownerId={restaurant.owner_id}
        restaurantType={restaurant.restaurant_type}
        cuisineTypes={restaurant.cuisine_types}
        createdAt={restaurant.created_at}
      />

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

      {/* Multi-branch setup: one-time menu copy, only while this restaurant is
          still empty (the RPC enforces the same guard server-side). */}
      {menusData.menus.length === 0 && (
        <CopyMenuSection restaurantId={restaurant.id} restaurantName={restaurant.name} />
      )}

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
