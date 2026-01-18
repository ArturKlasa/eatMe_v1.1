'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { ArrowLeft, Save } from 'lucide-react';

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

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<RestaurantFormData>();

  // Load restaurant data
  useEffect(() => {
    const loadRestaurant = async () => {
      if (!user?.id) return;

      try {
        const { data, error } = await supabase
          .from('restaurants')
          .select('*')
          .eq('owner_id', user.id)
          .single();

        if (error) throw error;

        if (data) {
          setRestaurantId(data.id);
          setValue('name', data.name);
          setValue('description', data.description || '');
          setValue('address', data.address);
          setValue('phone', data.phone || '');
          setValue('website', data.website || '');
        }
      } catch (err) {
        console.error('Failed to load restaurant:', err);
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
      const { error } = await supabase
        .from('restaurants')
        .update({
          name: data.name,
          description: data.description,
          address: data.address,
          phone: data.phone,
          website: data.website,
          updated_at: new Date().toISOString(),
        })
        .eq('id', restaurantId);

      if (error) throw error;

      toast.success('Restaurant information updated successfully!');
      router.push('/');
    } catch (err) {
      console.error('Failed to update restaurant:', err);
      toast.error('Failed to update restaurant information');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading restaurant information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-3xl">
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" onClick={() => router.push('/')} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold">Edit Restaurant Information</h1>
          <p className="text-gray-600 mt-2">Update your restaurant&apos;s basic information</p>
        </div>

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
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
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
