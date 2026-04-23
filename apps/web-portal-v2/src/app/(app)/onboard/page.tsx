import { redirect } from 'next/navigation';
import { verifySession } from '@/lib/auth/dal';
import { createServerClient } from '@/lib/supabase/server';
import { OnboardClient } from './OnboardClient';

/** Determine which step the user should resume from based on existing DB data. */
function deriveResumeStep(restaurant: {
  name: string;
  address: string | null;
  location: unknown;
  cuisine_types: string[] | null;
  open_hours: unknown;
  image_url?: string | null;
}): number {
  // Step 0: Basic info — always has name after creation
  if (!restaurant.name || restaurant.name.trim() === '') return 0;
  // Step 1: Location — must have a non-default location
  const hasLocation =
    restaurant.address &&
    restaurant.address.trim().length >= 5 &&
    restaurant.location !== null &&
    restaurant.location !== undefined;
  if (!hasLocation) return 1;
  // Step 2: Hours — must have open_hours or service flags set
  if (!restaurant.open_hours) return 2;
  // Step 3: Cuisines — must have at least one
  if (!restaurant.cuisine_types || restaurant.cuisine_types.length === 0) return 3;
  // Step 4: Photos — must have image_url
  if (!restaurant.image_url) return 4;
  // All done
  return 4;
}

export default async function OnboardPage() {
  const { userId } = await verifySession();
  const supabase = await createServerClient();

  const { data: restaurants } = await supabase
    .from('restaurants')
    .select(
      'id, name, description, restaurant_type, address, city, state, country_code, postal_code, neighbourhood, location, phone, website, cuisine_types, open_hours, delivery_available, takeout_available, dine_in_available, accepts_reservations, status, is_active, image_url'
    )
    .eq('owner_id', userId)
    .eq('status', 'draft')
    .limit(1);

  let restaurant = restaurants?.[0] ?? null;

  // Create a draft if none exists
  if (!restaurant) {
    const { data: created } = await supabase
      .from('restaurants')
      .insert({
        name: 'My Restaurant',
        status: 'draft',
        owner_id: userId,
        address: '',
        location: 'POINT(0 0)',
      })
      .select(
        'id, name, description, restaurant_type, address, city, state, country_code, postal_code, neighbourhood, location, phone, website, cuisine_types, open_hours, delivery_available, takeout_available, dine_in_available, accepts_reservations, status, is_active, image_url'
      )
      .single();

    if (!created) {
      // Fallback: if insert failed (race condition — another request may have created one)
      const { data: fallback } = await supabase
        .from('restaurants')
        .select(
          'id, name, description, restaurant_type, address, city, state, country_code, postal_code, neighbourhood, location, phone, website, cuisine_types, open_hours, delivery_available, takeout_available, dine_in_available, accepts_reservations, status, is_active, image_url'
        )
        .eq('owner_id', userId)
        .limit(1);
      if (fallback?.[0]?.status !== 'draft') {
        redirect(`/restaurant/${fallback?.[0]?.id}`);
      }
      restaurant = fallback?.[0] ?? null;
    } else {
      restaurant = created;
    }
  }

  if (!restaurant) {
    return (
      <div className="max-w-lg mx-auto py-12 text-center">
        <p className="text-muted-foreground">Something went wrong. Please refresh the page.</p>
      </div>
    );
  }

  const resumeStep = deriveResumeStep(restaurant);

  return <OnboardClient restaurant={restaurant} initialStep={resumeStep} />;
}
