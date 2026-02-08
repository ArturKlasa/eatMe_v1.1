'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface Ingredient {
  id: string;
  name: string;
  name_variants: string[];
  category: string;
  is_vegetarian: boolean;
  is_vegan: boolean;
  created_at: string;
}

const CATEGORIES = [
  'vegetable',
  'fruit',
  'protein',
  'grain',
  'dairy',
  'spice',
  'herb',
  'condiment',
  'oil',
  'sweetener',
  'beverage',
  'other',
];

export default function IngredientsPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    name_variants: '',
    category: 'other',
    is_vegetarian: true,
    is_vegan: false,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  useEffect(() => {
    fetchIngredients();
  }, []);

  const fetchIngredients = async () => {
    try {
      const { data, error } = await supabase
        .from('ingredients_master')
        .select('*')
        .order('name');

      if (error) throw error;
      setIngredients(data || []);
    } catch (error) {
      console.error('Error fetching ingredients:', error);
      toast.error('Failed to load ingredients');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const variants = formData.name_variants
        .split(',')
        .map(v => v.trim())
        .filter(v => v);

      const { error } = await supabase.from('ingredients_master').insert({
        name: formData.name,
        name_variants: variants,
        category: formData.category,
        is_vegetarian: formData.is_vegetarian,
        is_vegan: formData.is_vegan,
      });

      if (error) throw error;

      toast.success('Ingredient added successfully');
      setShowForm(false);
      setFormData({
        name: '',
        name_variants: '',
        category: 'other',
        is_vegetarian: true,
        is_vegan: false,
      });
      fetchIngredients();
    } catch (error: any) {
      console.error('Error adding ingredient:', error);
      toast.error('Failed to add ingredient: ' + error.message);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete ingredient "${name}"?`)) return;

    try {
      const { error } = await supabase.from('ingredients_master').delete().eq('id', id);

      if (error) throw error;

      toast.success('Ingredient deleted');
      fetchIngredients();
    } catch (error: any) {
      console.error('Error deleting ingredient:', error);
      toast.error('Failed to delete: ' + error.message);
    }
  };

  const filteredIngredients = ingredients.filter(ing => {
    const matchesSearch = ing.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'all' || ing.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Ingredients Master List</h1>
          <p className="text-gray-600 mt-1">Manage the database of ingredients</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600"
        >
          {showForm ? 'Cancel' : '+ Add Ingredient'}
        </button>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Add New Ingredient</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-md"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Name Variants (comma-separated)
              </label>
              <input
                type="text"
                value={formData.name_variants}
                onChange={e => setFormData({ ...formData, name_variants: e.target.value })}
                placeholder="e.g., tomatoes, roma tomato, cherry tomato"
                className="w-full px-3 py-2 border rounded-md"
              />
              <p className="text-xs text-gray-500 mt-1">Alternative names for autocomplete</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Category *</label>
              <select
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border rounded-md"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.is_vegetarian}
                  onChange={e => setFormData({ ...formData, is_vegetarian: e.target.checked })}
                  className="mr-2"
                />
                <span className="text-sm">Vegetarian</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.is_vegan}
                  onChange={e => setFormData({ ...formData, is_vegan: e.target.checked })}
                  className="mr-2"
                />
                <span className="text-sm">Vegan</span>
              </label>
            </div>

            <button
              type="submit"
              className="w-full px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
            >
              Add Ingredient
            </button>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search ingredients..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
          <div>
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              className="px-3 py-2 border rounded-md"
            >
              <option value="all">All Categories</option>
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-orange-500">{ingredients.length}</div>
          <div className="text-sm text-gray-600">Total Ingredients</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-green-500">
            {ingredients.filter(i => i.is_vegetarian).length}
          </div>
          <div className="text-sm text-gray-600">Vegetarian</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-green-600">
            {ingredients.filter(i => i.is_vegan).length}
          </div>
          <div className="text-sm text-gray-600">Vegan</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-blue-500">{filteredIngredients.length}</div>
          <div className="text-sm text-gray-600">Filtered</div>
        </div>
      </div>

      {/* Ingredients Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : filteredIngredients.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No ingredients found</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">Name</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Variants</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Category</th>
                <th className="px-4 py-3 text-center text-sm font-semibold">Vegetarian</th>
                <th className="px-4 py-3 text-center text-sm font-semibold">Vegan</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredIngredients.map(ing => (
                <tr key={ing.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{ing.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {ing.name_variants?.join(', ') || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 text-xs bg-gray-100 rounded">
                      {ing.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {ing.is_vegetarian ? '✓' : '-'}
                  </td>
                  <td className="px-4 py-3 text-center">{ing.is_vegan ? '✓' : '-'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(ing.id, ing.name)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      Delete
                    </button>
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
