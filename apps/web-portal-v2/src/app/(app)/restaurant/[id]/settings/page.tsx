import { notFound, redirect } from 'next/navigation';
import { verifySession, getRestaurant } from '@/lib/auth/dal';
import { SettingsActions } from './SettingsActions';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function RestaurantSettingsPage({ params }: Props) {
  const { id } = await params;
  const { userId } = await verifySession();
  const restaurant = await getRestaurant(id, userId);

  if (!restaurant) notFound();

  const status = (restaurant.status as string) ?? 'draft';

  if (status === 'archived') redirect(`/restaurant/${id}`);

  return (
    <div className="max-w-lg mx-auto py-8 px-4 space-y-8">
      <div>
        <h1 className="text-xl font-semibold mb-1">Settings</h1>
        <p className="text-sm text-muted-foreground">{restaurant.name}</p>
      </div>

      <SettingsActions restaurantId={id} status={status} />
    </div>
  );
}
