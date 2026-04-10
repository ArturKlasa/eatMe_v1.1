'use client';

import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { RestaurantForm, formDataToDbColumns } from '@/components/admin/RestaurantForm';
import type { RestaurantFormData } from '@/components/admin/RestaurantForm';

export default function NewRestaurantPage() {
  const router = useRouter();

  const handleCreate = async (data: RestaurantFormData) => {
    const lat = parseFloat(data.latitude ?? '');
    const lng = parseFloat(data.longitude ?? '');

    if (data.cuisine_types.length === 0) {
      toast.error('Please select at least one cuisine type');
      throw new Error('validation');
    }

    if (isNaN(lat) || isNaN(lng)) {
      toast.error('Please mark the location on the map');
      throw new Error('validation');
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      toast.error('Not authenticated');
      throw new Error('auth');
    }

    const { error } = await supabase.from('restaurants').insert({
      ...formDataToDbColumns(data),
      owner_id: userData.user.id,
      is_active: true,
    });

    if (error) {
      console.error('[Admin] Error creating restaurant:', error);
      toast.error('Failed to create restaurant');
      throw error;
    }

    toast.success('Restaurant created successfully!');
    router.push('/admin/restaurants');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 p-6">
      <div className="max-w-4xl mx-auto">
        <PageHeader
          title="Add New Restaurant"
          description="Create a new restaurant listing (Admin)"
          backHref="/admin/restaurants"
          breadcrumbs={[
            { label: 'Admin', href: '/admin' },
            { label: 'Restaurants', href: '/admin/restaurants' },
            { label: 'New' },
          ]}
        />
        <RestaurantForm
          mode="create"
          onSubmit={handleCreate}
          onCancel={() => router.push('/admin/restaurants')}
        />
      </div>
    </div>
  );
}
