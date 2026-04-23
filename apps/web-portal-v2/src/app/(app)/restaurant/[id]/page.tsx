import { notFound } from 'next/navigation';
import { verifySession, getRestaurant } from '@/lib/auth/dal';
import { BasicInfoForm } from '@/components/restaurant/BasicInfoForm';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function RestaurantBasicInfoPage({ params }: Props) {
  const { id } = await params;
  const { userId } = await verifySession();
  const restaurant = await getRestaurant(id, userId);

  if (!restaurant) notFound();

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <BasicInfoForm initial={restaurant} />
    </div>
  );
}
