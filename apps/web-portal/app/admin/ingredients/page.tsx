'use client';

import { useState, useEffect } from 'react';
import { Download } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface CanonicalIngredient {
  id: string;
  canonical_name: string;
  ingredient_family_name?: string;
  is_vegetarian: boolean;
  is_vegan: boolean;
  created_at: string;
}

interface IngredientAlias {
  id: string;
  display_name: string;
  canonical_ingredient_id: string;
  canonical_ingredient?: {
    canonical_name: string;
    ingredient_family_name?: string;
  };
  created_at: string;
}

export default function IngredientsPage() {
  const [activeTab, setActiveTab] = useState<'canonical' | 'aliases'>('aliases');
  const [canonicalIngredients, setCanonicalIngredients] = useState<CanonicalIngredient[]>([]);
  const [aliases, setAliases] = useState<IngredientAlias[]>([]);
  const [loading, setLoading] = useState(true);

  // Canonical ingredient form state
  const [showCanonicalForm, setShowCanonicalForm] = useState(false);
  const [canonicalFormData, setCanonicalFormData] = useState({
    canonical_name: '',
    ingredient_family_name: 'other',
    is_vegetarian: true,
    is_vegan: false,
  });

  // Alias form state
  const [showAliasForm, setShowAliasForm] = useState(false);
  const [aliasFormData, setAliasFormData] = useState({
    display_name: '',
    canonical_ingredient_id: '',
  });

  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch canonical ingredients
      const { data: canonicalData, error: canonicalError } = await supabase
        .from('canonical_ingredients')
        .select('*')
        .order('canonical_name');

      if (canonicalError) throw canonicalError;

      // Fetch aliases with canonical ingredient info
      const { data: aliasData, error: aliasError } = await supabase
        .from('ingredient_aliases')
        .select(
          `
          *,
          canonical_ingredient:canonical_ingredients(canonical_name, ingredient_family_name)
        `
        )
        .order('display_name');

      if (aliasError) throw aliasError;

      setCanonicalIngredients(canonicalData || []);
      setAliases(aliasData || []);
    } catch (error) {
      console.error('Error fetching ingredients:', error);
      toast.error('Failed to load ingredients');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitCanonical = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { error } = await supabase.from('canonical_ingredients').insert({
        canonical_name: canonicalFormData.canonical_name.toLowerCase().replace(/\s+/g, '_'),
        ingredient_family_name: canonicalFormData.ingredient_family_name,
        is_vegetarian: canonicalFormData.is_vegetarian,
        is_vegan: canonicalFormData.is_vegan,
      });

      if (error) throw error;

      toast.success('Canonical ingredient added successfully');
      setShowCanonicalForm(false);
      setCanonicalFormData({
        canonical_name: '',
        ingredient_family_name: 'other',
        is_vegetarian: true,
        is_vegan: false,
      });
      fetchData();
    } catch (error: any) {
      console.error('Error adding canonical ingredient:', error);
      toast.error('Failed to add: ' + error.message);
    }
  };

  const handleSubmitAlias = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { error } = await supabase.from('ingredient_aliases').insert({
        display_name: aliasFormData.display_name,
        canonical_ingredient_id: aliasFormData.canonical_ingredient_id,
      });

      if (error) throw error;

      toast.success('Alias added successfully');
      setShowAliasForm(false);
      setAliasFormData({
        display_name: '',
        canonical_ingredient_id: '',
      });
      fetchData();
    } catch (error: any) {
      console.error('Error adding alias:', error);
      toast.error('Failed to add: ' + error.message);
    }
  };

  const handleDeleteCanonical = async (id: string, name: string) => {
    if (!confirm(`Delete canonical ingredient "${name}"? This will also delete all its aliases.`))
      return;

    try {
      const { error } = await supabase.from('canonical_ingredients').delete().eq('id', id);

      if (error) throw error;

      toast.success('Canonical ingredient deleted');
      fetchData();
    } catch (error: any) {
      console.error('Error deleting:', error);
      toast.error('Failed to delete: ' + error.message);
    }
  };

  const handleDeleteAlias = async (id: string, name: string) => {
    if (!confirm(`Delete alias "${name}"?`)) return;

    try {
      const { error } = await supabase.from('ingredient_aliases').delete().eq('id', id);

      if (error) throw error;

      toast.success('Alias deleted');
      fetchData();
    } catch (error: any) {
      console.error('Error deleting:', error);
      toast.error('Failed to delete: ' + error.message);
    }
  };

  const handleExportCSV = () => {
    if (activeTab === 'canonical') {
      const rows = [
        ['canonical_name', 'ingredient_family_name', 'is_vegetarian', 'is_vegan'],
        ...canonicalIngredients.map(ing => [
          ing.canonical_name,
          ing.ingredient_family_name ?? '',
          ing.is_vegetarian ? 'true' : 'false',
          ing.is_vegan ? 'true' : 'false',
        ]),
      ];
      downloadCSV(rows, 'canonical_ingredients.csv');
    } else {
      const rows = [
        ['display_name', 'canonical_name', 'ingredient_family_name'],
        ...aliases.map(a => [
          a.display_name,
          a.canonical_ingredient?.canonical_name ?? '',
          a.canonical_ingredient?.ingredient_family_name ?? '',
        ]),
      ];
      downloadCSV(rows, 'ingredient_aliases.csv');
    }
  };

  const downloadCSV = (rows: string[][], filename: string) => {
    const escape = (val: string) => `"${val.replace(/"/g, '""')}"`;
    const csv = rows.map(r => r.map(escape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length - 1} rows to ${filename}`);
  };

  const filteredCanonical = canonicalIngredients.filter(ing =>
    ing.canonical_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredAliases = aliases.filter(
    alias =>
      alias.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      alias.canonical_ingredient?.canonical_name
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      alias.canonical_ingredient?.ingredient_family_name
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase())
  );

  const FAMILY_COLOURS: Record<string, string> = {
    fish: 'bg-blue-100 text-blue-800',
    shellfish: 'bg-cyan-100 text-cyan-800',
    meat: 'bg-red-100 text-red-800',
    poultry: 'bg-orange-100 text-orange-800',
    dairy: 'bg-yellow-100 text-yellow-800',
    eggs: 'bg-amber-100 text-amber-800',
    plant_milk: 'bg-lime-100 text-lime-800',
    vegetable: 'bg-green-100 text-green-800',
    fruit: 'bg-pink-100 text-pink-800',
    grain: 'bg-stone-100 text-stone-800',
    plant_protein: 'bg-teal-100 text-teal-800',
    nut_seed: 'bg-brown-100 text-yellow-900',
    spice_herb: 'bg-purple-100 text-purple-800',
    oil_fat: 'bg-yellow-50 text-yellow-700',
    condiment: 'bg-rose-100 text-rose-800',
    sweetener: 'bg-fuchsia-100 text-fuchsia-800',
    beverage: 'bg-sky-100 text-sky-800',
    alcohol: 'bg-violet-100 text-violet-800',
    baking: 'bg-orange-50 text-orange-700',
    other: 'bg-gray-100 text-gray-600',
  };

  const FamilyBadge = ({ family }: { family?: string }) => {
    const f = family ?? 'other';
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${FAMILY_COLOURS[f] ?? FAMILY_COLOURS.other}`}
      >
        {f.replace(/_/g, ' ')}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading ingredients...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Ingredients System</h1>
          <p className="text-gray-600 mt-1">
            Manage canonical ingredients and their display aliases
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('aliases')}
            className={`${
              activeTab === 'aliases'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Display Names ({aliases.length})
          </button>
          <button
            onClick={() => setActiveTab('canonical')}
            className={`${
              activeTab === 'canonical'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Canonical Ingredients ({canonicalIngredients.length})
          </button>
        </nav>
      </div>

      {/* Search and Add Button */}
      <div className="flex justify-between items-center mb-6">
        <input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg w-64"
        />
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50"
            title={`Export ${activeTab === 'canonical' ? 'canonical ingredients' : 'aliases'} as CSV`}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button
            onClick={() =>
              activeTab === 'canonical' ? setShowCanonicalForm(true) : setShowAliasForm(true)
            }
            className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600"
          >
            + Add {activeTab === 'canonical' ? 'Canonical' : 'Alias'}
          </button>
        </div>
      </div>

      {/* Canonical Ingredients Tab */}
      {activeTab === 'canonical' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Canonical Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Family
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vegetarian
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vegan
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredCanonical.map(ingredient => (
                <tr key={ingredient.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {ingredient.canonical_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <FamilyBadge family={ingredient.ingredient_family_name} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {ingredient.is_vegetarian ? '✓' : '✗'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {ingredient.is_vegan ? '✓' : '✗'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() =>
                        handleDeleteCanonical(ingredient.id, ingredient.canonical_name)
                      }
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Aliases Tab */}
      {activeTab === 'aliases' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Display Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  → Canonical Ingredient
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Family
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAliases.map(alias => (
                <tr key={alias.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {alias.display_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {alias.canonical_ingredient?.canonical_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <FamilyBadge family={alias.canonical_ingredient?.ingredient_family_name} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleDeleteAlias(alias.id, alias.display_name)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Canonical Ingredient Form Modal */}
      {showCanonicalForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Add Canonical Ingredient</h2>
            <form onSubmit={handleSubmitCanonical}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Canonical Name (lowercase_snake_case)
                </label>
                <input
                  type="text"
                  required
                  value={canonicalFormData.canonical_name}
                  onChange={e =>
                    setCanonicalFormData({ ...canonicalFormData, canonical_name: e.target.value })
                  }
                  placeholder="e.g., beef, tomato, olive_oil"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Will be converted to lowercase with underscores
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Family</label>
                <select
                  value={canonicalFormData.ingredient_family_name}
                  onChange={e =>
                    setCanonicalFormData({
                      ...canonicalFormData,
                      ingredient_family_name: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  {Object.keys(FAMILY_COLOURS).map(f => (
                    <option key={f} value={f}>
                      {f.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={canonicalFormData.is_vegetarian}
                    onChange={e =>
                      setCanonicalFormData({
                        ...canonicalFormData,
                        is_vegetarian: e.target.checked,
                      })
                    }
                    className="mr-2"
                  />
                  <span className="text-sm">Vegetarian</span>
                </label>
              </div>

              <div className="mb-6">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={canonicalFormData.is_vegan}
                    onChange={e =>
                      setCanonicalFormData({ ...canonicalFormData, is_vegan: e.target.checked })
                    }
                    className="mr-2"
                  />
                  <span className="text-sm">Vegan</span>
                </label>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCanonicalForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                >
                  Add
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Alias Form Modal */}
      {showAliasForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Add Display Name (Alias)</h2>
            <form onSubmit={handleSubmitAlias}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Display Name</label>
                <input
                  type="text"
                  required
                  value={aliasFormData.display_name}
                  onChange={e =>
                    setAliasFormData({ ...aliasFormData, display_name: e.target.value })
                  }
                  placeholder="e.g., Ground Beef, Roma Tomato, EVOO"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Maps to Canonical Ingredient
                </label>
                <select
                  required
                  value={aliasFormData.canonical_ingredient_id}
                  onChange={e =>
                    setAliasFormData({ ...aliasFormData, canonical_ingredient_id: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Select canonical ingredient...</option>
                  {canonicalIngredients.map(ing => (
                    <option key={ing.id} value={ing.id}>
                      {ing.canonical_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowAliasForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                >
                  Add
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
