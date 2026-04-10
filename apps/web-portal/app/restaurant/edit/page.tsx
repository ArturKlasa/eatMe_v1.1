'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useAuth } from '@/contexts/AuthContext';
import { getRestaurantForEdit, updateRestaurantInfo } from '@/lib/restaurantService';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Save, Loader2 } from 'lucide-react';
import { DAYS_OF_WEEK } from '@/lib/constants';
import { PageHeader } from '@/components/PageHeader';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { OperatingHoursEditor } from '@/components/forms/OperatingHoursEditor';

interface RestaurantFormData {
  name: string;
  description: string;
  address: string;
  phone: string;
  website: string;
}

function EditRestaurantContent() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);

  // Operating hours state
  const [operatingHours, setOperatingHours] = useState<
    Record<string, { open: string; close: string; closed: boolean }>
  >({
    monday: { open: '09:00', close: '21:00', closed: false },
    tuesday: { open: '09:00', close: '21:00', closed: false },
    wednesday: { open: '09:00', close: '21:00', closed: false },
    thursday: { open: '09:00', close: '21:00', closed: false },
    friday: { open: '09:00', close: '22:00', closed: false },
    saturday: { open: '09:00', close: '22:00', closed: false },
    sunday: { open: '10:00', close: '20:00', closed: false },
  });

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isDirty },
  } = useForm<RestaurantFormData>();

  const [hoursChanged, setHoursChanged] = useState(false);
  const hasUnsavedChanges = isDirty || hoursChanged;

  const handleOperatingHoursChange = useCallback((hours: Record<string, { open: string; close: string; closed: boolean }>) => {
    setOperatingHours(hours);
    setHoursChanged(true);
  }, []);

  // Unsaved changes warning
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);

  // Load restaurant data
  useEffect(() => {
    const loadRestaurant = async () => {
      if (!user?.id) return;
      try {
        const data = await getRestaurantForEdit(user.id);
        setRestaurantId(data.id);
        setValue('name', data.name);
        setValue('description', data.description || '');
        setValue('address', data.address);
        setValue('phone', data.phone || '');
        setValue('website', data.website || '');
        if (data.open_hours) {
          const hours: Record<string, { open: string; close: string; closed: boolean }> = {};
          DAYS_OF_WEEK.forEach(({ key }) => {
            const dayHours = data.open_hours?.[key];
            hours[key] = dayHours
              ? { open: dayHours.open, close: dayHours.close, closed: false }
              : { open: '09:00', close: '21:00', closed: true };
          });
          setOperatingHours(hours);
        }
      } catch (err) {
        console.error('[EditRestaurant] Failed to load restaurant:', err);
        toast.error('Failed to load restaurant data');
      } finally {
        setLoading(false);
      }
    };
    loadRestaurant();
  }, [user, setValue]);

  const onSubmit = async (data: RestaurantFormData) => {
    if (!restaurantId) {
      toast.error('No restaurant found');
      return;
    }
    setSaving(true);
    try {
      await updateRestaurantInfo(restaurantId, data, operatingHours);
      toast.success('Restaurant information updated successfully!');
      router.push('/');
    } catch (err) {
      console.error('[EditRestaurant] Failed to update restaurant:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to update restaurant');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4 max-w-3xl">
          <LoadingSkeleton variant="form" count={5} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-3xl">
        {/* Header */}
        <PageHeader
          title="Edit Restaurant Information"
          description="Update your restaurant's basic information"
          breadcrumbs={[
            { label: 'Dashboard', href: '/' },
            { label: 'Edit Restaurant' },
          ]}
          backHref="/"
        />

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)}>
          <Card>
            <CardHeader>
              <CardTitle>Restaurant Details</CardTitle>
              <CardDescription>
                Changes will be saved directly to your restaurant profile
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Restaurant Name */}
              <div>
                <Label htmlFor="name">Restaurant Name *</Label>
                <Input
                  id="name"
                  {...register('name', { required: 'Restaurant name is required' })}
                  placeholder="My Restaurant"
                />
                {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>}
              </div>

              {/* Description */}
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  {...register('description')}
                  placeholder="Tell customers about your restaurant..."
                  rows={4}
                />
              </div>

              {/* Address */}
              <div>
                <Label htmlFor="address">Address *</Label>
                <Input
                  id="address"
                  {...register('address', { required: 'Address is required' })}
                  placeholder="123 Main St, City, Country"
                />
                {errors.address && (
                  <p className="text-sm text-red-500 mt-1">{errors.address.message}</p>
                )}
              </div>

              {/* Phone */}
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  {...register('phone')}
                  placeholder="+1 (555) 123-4567"
                />
              </div>

              {/* Website */}
              <div>
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  type="url"
                  {...register('website')}
                  placeholder="https://www.myrestaurant.com"
                />
              </div>
            </CardContent>
          </Card>

          {/* Operating Hours */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Operating Hours</CardTitle>
              <CardDescription>Update your business hours</CardDescription>
            </CardHeader>
            <CardContent>
              <OperatingHoursEditor value={operatingHours} onChange={handleOperatingHoursChange} />
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="mt-6 flex gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/')}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="flex-1">
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </form>
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
