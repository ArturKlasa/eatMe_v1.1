'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getRestaurantForEdit } from '@/lib/restaurantService';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { PageHeader } from '@/components/PageHeader';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import {
  RestaurantForm,
  OWNER_EDIT_SECTIONS,
  convertDbToFormData,
  formDataToDbColumns,
} from '@/components/admin/RestaurantForm';
import type { RestaurantFormData } from '@/components/admin/RestaurantForm';

function EditRestaurantContent() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [initialData, setInitialData] = useState<Partial<RestaurantFormData> | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const data = await getRestaurantForEdit(user.id);
        setRestaurantId(data.id);
        setInitialData(convertDbToFormData(data as Record<string, unknown>));
      } catch (err) {
        console.error('[EditRestaurant] Failed to load restaurant:', err);
        toast.error('Failed to load restaurant data');
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const handleUpdate = async (data: RestaurantFormData) => {
    if (!restaurantId) {
      toast.error('No restaurant found');
      throw new Error('No restaurant ID');
    }
    const { error } = await supabase
      .from('restaurants')
      .update(formDataToDbColumns(data))
      .eq('id', restaurantId);
    if (error) {
      console.error('[EditRestaurant] Failed to update restaurant:', error);
      toast.error('Failed to update restaurant');
      throw error;
    }
    toast.success('Restaurant information updated successfully!');
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/30 py-8">
        <div className="container mx-auto px-4 max-w-3xl">
          <LoadingSkeleton variant="form" count={5} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-8">
      <div className="container mx-auto px-4 max-w-3xl">
        <PageHeader
          title="Edit Restaurant Information"
          description="Update your restaurant's information, cuisines, and service options"
          breadcrumbs={[
            { label: 'Dashboard', href: '/' },
            { label: 'Edit Restaurant' },
          ]}
          backHref="/"
        />

        <div className="mt-6">
          <RestaurantForm
            mode="edit"
            sections={OWNER_EDIT_SECTIONS}
            initialData={initialData ?? undefined}
            enableDraft={false}
            onSuccess={handleUpdate}
            onCancel={() => router.push('/')}
          />
        </div>
      </div>
    </div>
  );
}

export default function EditRestaurantPage() {
  return (
    <ProtectedRoute>
      <EditRestaurantContent />
    </ProtectedRoute>
  );
}
