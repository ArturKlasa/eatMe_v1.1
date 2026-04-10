'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/PageHeader';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { RestaurantForm, convertDbToFormData, formDataToDbColumns } from '@/components/admin/RestaurantForm';
import type { RestaurantFormData } from '@/components/admin/RestaurantForm';

export default function EditRestaurantPage() {
  const router = useRouter();
  const restaurantId = (useParams()).id as string;
  const [fetching, setFetching] = useState(true);
  const [initialData, setInitialData] = useState<Partial<RestaurantFormData> | null>(null);
  const [restaurantName, setRestaurantName] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from('restaurants').select('*').eq('id', restaurantId).single();
        if (error) {
          console.error('[Admin] Error fetching restaurant:', error);
          toast.error('Failed to load restaurant');
          router.push('/admin/restaurants');
          return;
        }
        if (data) {
          setRestaurantName(data.name || '');
          setInitialData(convertDbToFormData(data));
        }
      } catch (err) {
        console.error('[Admin] Unexpected error:', err);
        toast.error('An unexpected error occurred');
        router.push('/admin/restaurants');
      } finally {
        setFetching(false);
      }
    })();
  }, [restaurantId, router]);

  const handleUpdate = async (data: RestaurantFormData) => {
    if (isNaN(parseFloat(data.latitude ?? '')) || isNaN(parseFloat(data.longitude ?? ''))) {
      toast.error('Please enter valid coordinates');
      throw new Error('validation');
    }
    const { error } = await supabase
      .from('restaurants').update(formDataToDbColumns(data)).eq('id', restaurantId);
    if (error) {
      console.error('[Admin] Error updating restaurant:', error);
      toast.error('Failed to update restaurant');
      throw error;
    }
    toast.success('Restaurant updated successfully!');
    router.push('/admin/restaurants');
  };

  if (fetching) return <div className="space-y-6"><LoadingSkeleton variant="page" /></div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Restaurant"
        description="Update restaurant information"
        backHref="/admin/restaurants"
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Restaurants', href: '/admin/restaurants' },
          { label: restaurantName || 'Edit' },
        ]}
        actions={
          <Button asChild variant="outline">
            <Link href={`/admin/restaurants/${restaurantId}/menus`}>Manage Menus</Link>
          </Button>
        }
      />
      <RestaurantForm
        mode="edit"
        initialData={initialData ?? undefined}
        onSubmit={handleUpdate}
        onCancel={() => router.push('/admin/restaurants')}
      />
    </div>
  );
}
