'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { EditableIngredient } from '@/lib/menu-scan';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Allergen {
  id: string;
  code: string;
  name: string;
  icon: string;
}

interface AddIngredientPanelProps {
  /** The raw text extracted from the menu (pre-fills the name field) */
  rawText: string;
  /** Called when the ingredient is successfully created, with the resolved ingredient data */
  onSuccess: (ingredient: EditableIngredient) => void;
  /** Called when the panel is dismissed without saving */
  onClose: () => void;
}

const FAMILY_OPTIONS = [
  { value: 'vegetable', label: 'Vegetable' },
  { value: 'fruit', label: 'Fruit' },
  { value: 'protein', label: 'Protein / Meat' },
  { value: 'grain', label: 'Grain / Starch' },
  { value: 'dairy', label: 'Dairy' },
  { value: 'spice', label: 'Spice' },
  { value: 'herb', label: 'Herb' },
  { value: 'condiment', label: 'Condiment / Sauce' },
  { value: 'oil', label: 'Oil / Fat' },
  { value: 'sweetener', label: 'Sweetener' },
  { value: 'beverage', label: 'Beverage' },
  { value: 'other', label: 'Other' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AddIngredientPanel({ rawText, onSuccess, onClose }: AddIngredientPanelProps) {
  const [canonicalName, setCanonicalName] = useState(rawText.toLowerCase().trim());
  const [familyName, setFamilyName] = useState('other');
  const [isVegetarian, setIsVegetarian] = useState(true);
  const [isVegan, setIsVegan] = useState(false);
  const [selectedAllergenCodes, setSelectedAllergenCodes] = useState<string[]>([]);
  const [extraAliases, setExtraAliases] = useState('');
  const [allergens, setAllergens] = useState<Allergen[]>([]);
  const [saving, setSaving] = useState(false);

  // Load allergens list on mount
  useEffect(() => {
    supabase
      .from('allergens')
      .select('id, code, name, icon')
      .order('name')
      .then(({ data }) => {
        if (data) setAllergens(data as Allergen[]);
      });
  }, []);

  // Auto-uncheck vegan when vegetarian is unchecked (vegan implies vegetarian)
  useEffect(() => {
    if (!isVegetarian) setIsVegan(false);
  }, [isVegetarian]);

  // Auto-check vegetarian when vegan is checked
  useEffect(() => {
    if (isVegan) setIsVegetarian(true);
  }, [isVegan]);

  const toggleAllergen = (code: string) => {
    setSelectedAllergenCodes(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const handleSubmit = async () => {
    if (!canonicalName.trim()) {
      toast.error('Ingredient name is required');
      return;
    }

    setSaving(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('Session expired — please reload');
        return;
      }

      const aliasArray = extraAliases
        .split(',')
        .map(s => s.trim().toLowerCase())
        .filter(s => s.length > 0);

      const response = await fetch('/api/ingredients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          canonical_name: canonicalName.trim().toLowerCase(),
          ingredient_family_name: familyName,
          is_vegetarian: isVegetarian,
          is_vegan: isVegan,
          allergen_codes: selectedAllergenCodes,
          extra_aliases: aliasArray,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409 && data.existing) {
          // Already exists — treat as success so the dish can be linked
          toast.info(`"${data.existing.canonical_name}" already exists, linking it.`);
          onSuccess({
            raw_text: rawText,
            status: 'matched',
            canonical_ingredient_id: data.existing.id,
            canonical_name: data.existing.canonical_name,
            display_name: data.existing.canonical_name,
          });
          return;
        }
        throw new Error(data.error || 'Failed to create ingredient');
      }

      toast.success(`Added "${data.ingredient.canonical_name}" to ingredients`);

      onSuccess({
        raw_text: rawText,
        status: 'matched',
        canonical_ingredient_id: data.ingredient.id,
        canonical_name: data.ingredient.canonical_name,
        display_name: data.alias?.display_name ?? data.ingredient.canonical_name,
      });
    } catch (error: any) {
      console.error('[AddIngredientPanel] Error:', error);
      toast.error(error.message || 'Failed to add ingredient');
    } finally {
      setSaving(false);
    }
  };

  return (
    // Backdrop
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
      {/* Panel */}
      <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-orange-50">
          <div>
            <h3 className="font-semibold text-gray-900 text-lg">Add New Ingredient</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              From menu: <span className="italic text-gray-700">"{rawText}"</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Canonical name */}
          <div>
            <Label htmlFor="canonical_name" className="text-sm font-medium">
              Canonical Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="canonical_name"
              value={canonicalName}
              onChange={e => setCanonicalName(e.target.value)}
              placeholder="e.g. olive oil"
              className="mt-1"
              autoFocus
            />
            <p className="text-xs text-gray-400 mt-1">
              Lowercase, singular. This is the unique ID-like name in the database.
            </p>
          </div>

          {/* Family / category */}
          <div>
            <Label htmlFor="family" className="text-sm font-medium">
              Category
            </Label>
            <select
              id="family"
              value={familyName}
              onChange={e => setFamilyName(e.target.value)}
              className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
            >
              {FAMILY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Vegetarian / vegan toggles */}
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isVegetarian}
                onChange={e => setIsVegetarian(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">🥗 Vegetarian</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isVegan}
                onChange={e => setIsVegan(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">🌱 Vegan</span>
            </label>
          </div>

          {/* Allergens */}
          {allergens.length > 0 && (
            <div>
              <Label className="text-sm font-medium">Allergens</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {allergens.map(allergen => {
                  const selected = selectedAllergenCodes.includes(allergen.code);
                  return (
                    <button
                      key={allergen.code}
                      type="button"
                      onClick={() => toggleAllergen(allergen.code)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        selected
                          ? 'bg-red-100 border-red-300 text-red-800'
                          : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {allergen.icon && <span>{allergen.icon}</span>}
                      {allergen.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Extra aliases */}
          <div>
            <Label htmlFor="aliases" className="text-sm font-medium">
              Additional Names / Aliases
            </Label>
            <Input
              id="aliases"
              value={extraAliases}
              onChange={e => setExtraAliases(e.target.value)}
              placeholder="e.g. aceite de oliva, EVOO"
              className="mt-1"
            />
            <p className="text-xs text-gray-400 mt-1">
              Comma-separated. The canonical name is always added automatically.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-100 bg-gray-50">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || !canonicalName.trim()}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Add Ingredient
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
