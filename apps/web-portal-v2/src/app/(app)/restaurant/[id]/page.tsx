import Link from 'next/link';
import { notFound } from 'next/navigation';
import { verifySession, getRestaurant } from '@/lib/auth/dal';
import { BasicInfoSection } from '@/components/restaurant/BasicInfoSection';
import { LocationSection } from '@/components/restaurant/LocationSection';
import { HoursSection } from '@/components/restaurant/HoursSection';
import { CuisinesSection } from '@/components/restaurant/CuisinesSection';
import { PhotosSection } from '@/components/restaurant/PhotosSection';
import { PublishButton } from '@/components/restaurant/PublishButton';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function RestaurantPage({ params }: Props) {
  const { id } = await params;
  const { userId } = await verifySession();
  const restaurant = await getRestaurant(id, userId);

  if (!restaurant) notFound();

  // Parse location coordinates from PostGIS GeoJSON response
  let initialLat: number | undefined;
  let initialLng: number | undefined;
  if (
    restaurant.location &&
    typeof restaurant.location === 'object' &&
    'coordinates' in (restaurant.location as object)
  ) {
    const loc = restaurant.location as { coordinates: [number, number] };
    initialLng = loc.coordinates[0];
    initialLat = loc.coordinates[1];
    if (initialLat === 0 && initialLng === 0) {
      initialLat = undefined;
      initialLng = undefined;
    }
  }

  // Determine publishability server-side: name, address, location, and at least one cuisine required.
  const hasValidAddress = (restaurant.address?.length ?? 0) >= 5;
  const hasValidLocation = initialLat !== undefined && initialLng !== undefined;
  const hasCuisines = (restaurant.cuisine_types?.length ?? 0) >= 1;
  const isPublishable = hasValidAddress && hasValidLocation && hasCuisines;

  const status = (restaurant.status as string) ?? 'draft';

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-12">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{restaurant.name}</h1>
        <div className="flex items-center gap-4">
          <PublishButton
            restaurantId={restaurant.id}
            status={status}
            isPublishable={isPublishable}
          />
          <Link
            href={`/restaurant/${restaurant.id}/settings`}
            className="text-sm text-muted-foreground hover:underline"
          >
            Settings
          </Link>
        </div>
      </div>

      <BasicInfoSection initial={restaurant} mode="edit" />

      <div className="border-t border-border pt-8">
        <LocationSection
          restaurantId={restaurant.id}
          initialAddress={restaurant.address ?? ''}
          initialLat={initialLat}
          initialLng={initialLng}
        />
      </div>

      <div className="border-t border-border pt-8">
        <HoursSection
          restaurantId={restaurant.id}
          initial={{
            open_hours:
              (restaurant.open_hours as Record<string, { open: string; close: string }> | null) ??
              null,
            delivery_available: restaurant.delivery_available,
            takeout_available: restaurant.takeout_available,
            dine_in_available: restaurant.dine_in_available,
            accepts_reservations: restaurant.accepts_reservations,
          }}
        />
      </div>

      <div className="border-t border-border pt-8">
        <CuisinesSection
          restaurantId={restaurant.id}
          initialCuisines={restaurant.cuisine_types ?? []}
          restaurantName={restaurant.name}
        />
      </div>

      <div className="border-t border-border pt-8">
        <PhotosSection
          restaurantId={restaurant.id}
          initialImageUrl={(restaurant as { image_url?: string | null }).image_url ?? null}
        />
      </div>
    </div>
  );
}
