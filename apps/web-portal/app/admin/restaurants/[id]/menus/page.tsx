'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Plus, Edit, Trash2, Loader2, Utensils } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface Menu {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
}

export default function RestaurantMenusPage() {
  const router = useRouter();
  const params = useParams();
  const restaurantId = params.id as string;

  const [restaurantName, setRestaurantName] = useState('');
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);

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

        // Fetch menus
        const { data: menusData, error } = await supabase
          .from('menus')
          .select('*')
          .eq('restaurant_id', restaurantId)
          .order('display_order', { ascending: true });

        if (error) {
          console.error('[Admin] Error fetching menus:', error);
          toast.error('Failed to load menus');
        } else {
          setMenus(menusData || []);
        }
      } catch (error) {
        console.error('[Admin] Unexpected error:', error);
        toast.error('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [restaurantId]);

  const handleDelete = async (menuId: string, menuName: string) => {
    const confirmed = window.confirm(
      `Delete menu "${menuName}"?\n\nThis will also delete all dishes in this menu. This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase.from('menus').delete().eq('id', menuId);

      if (error) {
        console.error('[Admin] Error deleting menu:', error);
        toast.error('Failed to delete menu');
        return;
      }

      toast.success('Menu deleted successfully');
      setMenus(prev => prev.filter(m => m.id !== menuId));
    } catch (error) {
      console.error('[Admin] Unexpected error:', error);
      toast.error('An unexpected error occurred');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/admin/restaurants/${restaurantId}`}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Menus</h1>
            <p className="mt-2 text-gray-600">{restaurantName}</p>
          </div>
        </div>

        <Link
          href={`/admin/restaurants/${restaurantId}/menus/new`}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
        >
          <Plus className="h-5 w-5" />
          Add Menu
        </Link>
      </div>

      {/* Menus List */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {menus.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500 mb-4">No menus yet</p>
            <Link
              href={`/admin/restaurants/${restaurantId}/menus/new`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
            >
              <Plus className="h-5 w-5" />
              Add First Menu
            </Link>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  Menu Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  Order
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {menus.map(menu => (
                <tr key={menu.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-gray-900">{menu.name}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(menu.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {menu.description || <span className="text-gray-400">No description</span>}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{menu.display_order}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                        menu.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-700'
                      }`}
                    >
                      {menu.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/restaurants/${restaurantId}/menus/${menu.id}/dishes`}
                        className="p-2 text-orange-600 hover:bg-orange-50 rounded"
                        title="Manage Dishes"
                      >
                        <Utensils className="h-4 w-4" />
                      </Link>
                      <Link
                        href={`/admin/restaurants/${restaurantId}/menus/${menu.id}/edit`}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </Link>
                      <button
                        onClick={() => handleDelete(menu.id, menu.name)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
