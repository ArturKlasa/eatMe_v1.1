'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Loader2, Utensils } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

export default function EditMenuPage() {
  const router = useRouter();
  const params = useParams();
  const restaurantId = params.id as string;
  const menuId = params.menuId as string;

  const [restaurantName, setRestaurantName] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    display_order: 1,
    is_active: true,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch restaurant name
        const { data: restaurant } = await supabase
          .from('restaurants')
          .select('name')
          .eq('id', restaurantId)
          .single();

        if (restaurant) {
          setRestaurantName(restaurant.name);
        }

        // Fetch menu data
        const { data: menu, error } = await supabase
          .from('menus')
          .select('*')
          .eq('id', menuId)
          .single();

        if (error) {
          console.error('[Admin] Error fetching menu:', error);
          toast.error('Failed to load menu');
          router.push(`/admin/restaurants/${restaurantId}/menus`);
          return;
        }

        if (menu) {
          setFormData({
            name: menu.name || '',
            description: menu.description || '',
            display_order: menu.display_order || 1,
            is_active: menu.is_active !== false,
          });
        }
      } catch (error) {
        console.error('[Admin] Unexpected error:', error);
        toast.error('An unexpected error occurred');
        router.push(`/admin/restaurants/${restaurantId}/menus`);
      } finally {
        setFetching(false);
      }
    };

    fetchData();
  }, [restaurantId, menuId, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('menus')
        .update({
          name: formData.name,
          description: formData.description || null,
          display_order: formData.display_order,
          is_active: formData.is_active,
        })
        .eq('id', menuId);

      if (error) {
        console.error('[Admin] Error updating menu:', error);
        toast.error('Failed to update menu');
        setLoading(false);
        return;
      }

      toast.success('Menu updated successfully!');
      router.push(`/admin/restaurants/${restaurantId}/menus`);
    } catch (error) {
      console.error('[Admin] Unexpected error:', error);
      toast.error('An unexpected error occurred');
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/admin/restaurants/${restaurantId}/menus`}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Edit Menu</h1>
          <p className="mt-2 text-gray-600">{restaurantName}</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Utensils className="h-5 w-5 text-orange-600" />
              <CardTitle>Menu Details</CardTitle>
            </div>
            <CardDescription>
              Edit menu for {restaurantName}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Menu Name *</Label>
              <Input
                id="name"
                required
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Lunch Menu, Dinner Specials, Drinks"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                className="w-full min-h-[80px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Brief description of this menu..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="order">Display Order</Label>
              <Input
                id="order"
                type="number"
                min="1"
                value={formData.display_order}
                onChange={e => setFormData({ ...formData, display_order: parseInt(e.target.value) })}
              />
              <p className="text-sm text-muted-foreground">
                Menus will be displayed in this order (lower numbers first)
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="active"
                checked={formData.is_active}
                onCheckedChange={checked => setFormData({ ...formData, is_active: checked as boolean })}
              />
              <Label htmlFor="active" className="cursor-pointer">
                ✅ Active (visible to customers)
              </Label>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-4">
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Save Changes
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href={`/admin/restaurants/${restaurantId}/menus`}>Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
