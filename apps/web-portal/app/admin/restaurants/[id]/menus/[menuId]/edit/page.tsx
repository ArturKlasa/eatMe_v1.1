'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

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
      <form
        onSubmit={handleSubmit}
        className="bg-white border border-gray-200 rounded-lg p-6 space-y-6"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Menu Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="e.g., Lunch Menu, Dinner Specials, Drinks"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              rows={3}
              placeholder="Brief description of this menu..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Display Order</label>
            <input
              type="number"
              min="1"
              value={formData.display_order}
              onChange={e => setFormData({ ...formData, display_order: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Menus will be displayed in this order (lower numbers first)
            </p>
          </div>

          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
              />
              <span className="text-sm text-gray-700">Active (visible to customers)</span>
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4 pt-4 border-t border-gray-200">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Changes
          </button>

          <Link
            href={`/admin/restaurants/${restaurantId}/menus`}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
