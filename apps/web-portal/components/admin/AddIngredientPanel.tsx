'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Plus, Loader2, Search, Link2, ArrowLeft, Leaf, Sprout } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { searchIngredients, type Ingredient } from '@/lib/ingredients';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { EditableIngredient } from '@/lib/menu-scan';

// ---------------------------------------------------------------------------
import { getAllergenIcon } from '@/lib/icons';

// Types
// ---------------------------------------------------------------------------

interface Allergen {
  id: string;
  code: string;
  name: string;
}

interface AddIngredientPanelProps {
  /** The raw text extracted from the menu (pre-fills the search field) */
  rawText: string;
  /** Called when an ingredient is resolved (linked or newly created) */
  onSuccess: (ingredient: EditableIngredient) => void;
  /** Called when the panel is dismissed without saving */
  onClose: () => void;
}

type Mode = 'search' | 'add-new';

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

// Family label helper
function familyLabel(family?: string) {
  return FAMILY_OPTIONS.find(o => o.value === family)?.label ?? family ?? '';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AddIngredientPanel({ rawText, onSuccess, onClose }: AddIngredientPanelProps) {
  const [mode, setMode] = useState<Mode>('search');

  // ── Search mode state ──────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState(rawText.trim());
  const [searchResults, setSearchResults] = useState<Ingredient[]>([]);
  const [searching, setSearching] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Add-new mode state ─────────────────────────────────────────────────
  const [canonicalName, setCanonicalName] = useState(rawText.toLowerCase().trim());
  const [familyName, setFamilyName] = useState('other');
  const [isVegetarian, setIsVegetarian] = useState(true);
  const [isVegan, setIsVegan] = useState(false);
  const [selectedAllergenCodes, setSelectedAllergenCodes] = useState<string[]>([]);
  const [extraAliases, setExtraAliases] = useState('');
  const [allergens, setAllergens] = useState<Allergen[]>([]);
  const [saving, setSaving] = useState(false);

  // ── Seed an initial search on open ────────────────────────────────────
  useEffect(() => {
    if (rawText.trim().length >= 2) {
      runSearch(rawText.trim());
    }
    // Load allergens for the add-new form
    supabase
      .from('allergens')
      .select('id, code, name')
      .order('name')
      .then(({ data }) => {
        if (data) setAllergens(data as Allergen[]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Debounced search on query change ──────────────────────────────────
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    searchDebounceRef.current = setTimeout(() => runSearch(searchQuery.trim()), 250);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery]);

  async function runSearch(q: string) {
    setSearching(true);
    const { data } = await searchIngredients(q, 20);
    setSearchResults(data);
    setSearching(false);
  }

  // ── Link an existing ingredient ───────────────────────────────────────
  function handleLinkExisting(ingredient: Ingredient) {
    toast.success(`Linked to "${ingredient.display_name}"`);
    onSuccess({
      raw_text: rawText,
      status: 'matched',
      canonical_ingredient_id: ingredient.canonical_ingredient_id,
      canonical_name: ingredient.canonical_name,
      display_name: ingredient.display_name,
    });
  }

  // ── Auto-uncheck vegan when vegetarian is unchecked ───────────────────
  useEffect(() => {
    if (!isVegetarian) setIsVegan(false);
  }, [isVegetarian]);

  useEffect(() => {
    if (isVegan) setIsVegetarian(true);
  }, [isVegan]);

  const toggleAllergen = (code: string) => {
    setSelectedAllergenCodes(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  // ── Create new ingredient ─────────────────────────────────────────────
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
          toast.info(`"${data.existing.canonical_name}" already exists — linking it.`);
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
    } catch (error: unknown) {
      console.error('[AddIngredientPanel] Error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add ingredient');
    } finally {
      setSaving(false);
    }
  };

  // ── Deduplicate results by canonical_ingredient_id ────────────────────
  // Show at most one alias per canonical, with the closest display_name first
  const deduped = searchResults.reduce<Ingredient[]>((acc, item) => {
    if (!acc.find(x => x.canonical_ingredient_id === item.canonical_ingredient_id)) {
      acc.push(item);
    }
    return acc;
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-md bg-background rounded-xl shadow-2xl border border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border bg-brand-primary/5">
          <div className="flex items-center gap-2 min-w-0">
            {mode === 'add-new' && (
              <button
                onClick={() => setMode('search')}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-background/60 shrink-0"
                title="Back to search"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground">
                {mode === 'search' ? 'Link Ingredient' : 'Add New Ingredient'}
              </h3>
              <p className="text-xs text-muted-foreground truncate">
                From menu:{' '}
                <span className="italic text-foreground">
                  {'"'}
                  {rawText}
                  {'"'}
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-accent transition-colors shrink-0"
            aria-label="Close panel"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── SEARCH MODE ────────────────────────────────────────────── */}
        {mode === 'search' && (
          <>
            <div className="p-4 space-y-3">
              {/* Editable search input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  autoFocus
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search ingredient name…"
                  className="pl-9 pr-9"
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
                )}
              </div>

              {/* Results list */}
              <div className="max-h-64 overflow-y-auto rounded-lg border border divide-y divide-muted/30">
                {!searching && searchQuery.trim().length >= 2 && deduped.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No matches for &ldquo;{searchQuery}&rdquo;
                  </p>
                )}
                {searchQuery.trim().length < 2 && (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Type at least 2 characters to search
                  </p>
                )}
                {deduped.map(item => (
                  <button
                    key={item.canonical_ingredient_id}
                    type="button"
                    onClick={() => handleLinkExisting(item)}
                    className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-brand-primary/5 transition-colors text-left group"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {item.display_name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {item.canonical_name}
                        {item.ingredient_family_name && (
                          <span className="ml-1.5 text-muted-foreground">·</span>
                        )}
                        {item.ingredient_family_name && (
                          <span className="ml-1 text-muted-foreground">
                            {familyLabel(item.ingredient_family_name)}
                          </span>
                        )}
                        {item.is_vegan && (
                          <Leaf className="ml-1.5 h-3 w-3 inline-block text-success" />
                        )}
                        {!item.is_vegan && item.is_vegetarian && (
                          <Sprout className="ml-1.5 h-3 w-3 inline-block text-success" />
                        )}
                      </p>
                    </div>
                    <Link2 className="h-4 w-4 text-muted-foreground group-hover:text-brand-primary shrink-0 ml-2 transition-colors" />
                  </button>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-3 border-t border bg-muted/30">
              <p className="text-xs text-muted-foreground">Not in the list?</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setCanonicalName(searchQuery.toLowerCase().trim());
                  setMode('add-new');
                }}
                className="text-brand-primary border-orange-200 hover:bg-brand-primary/5"
              >
                <Plus className="h-3.5 w-3.5" />
                Add as new
              </Button>
            </div>
          </>
        )}

        {/* ── ADD-NEW MODE ───────────────────────────────────────────── */}
        {mode === 'add-new' && (
          <>
            <div className="p-4 space-y-4 max-h-[65vh] overflow-y-auto">
              {/* Canonical name */}
              <div>
                <Label htmlFor="canonical_name" className="text-sm font-medium">
                  Canonical Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="canonical_name"
                  value={canonicalName}
                  onChange={e => setCanonicalName(e.target.value)}
                  placeholder="e.g. olive oil"
                  className="mt-1"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Lowercase, singular. Unique DB identifier.
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
                <label className={cn('flex items-center gap-2 cursor-pointer')}>
                  <input
                    type="checkbox"
                    checked={isVegetarian}
                    onChange={e => setIsVegetarian(e.target.checked)}
                    className="h-4 w-4 rounded border-input"
                  />
                  <span className="text-sm text-foreground flex items-center gap-1">
                    <Sprout className="h-3.5 w-3.5" /> Vegetarian
                  </span>
                </label>
                <label className={cn('flex items-center gap-2 cursor-pointer')}>
                  <input
                    type="checkbox"
                    checked={isVegan}
                    onChange={e => setIsVegan(e.target.checked)}
                    className="h-4 w-4 rounded border-input"
                  />
                  <span className="text-sm text-foreground flex items-center gap-1">
                    <Leaf className="h-3.5 w-3.5" /> Vegan
                  </span>
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
                          className={cn(
                            'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                            selected
                              ? 'bg-destructive/10 border-red-300 text-destructive'
                              : 'bg-muted/30 border hover:border-input text-muted-foreground'
                          )}
                        >
                          <span>{getAllergenIcon(allergen.code)}</span>
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
                <p className="text-xs text-muted-foreground mt-1">
                  Comma-separated. Canonical name is always added automatically.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-4 border-t border bg-muted/30">
              <Button variant="outline" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={saving || !canonicalName.trim()}
                className="bg-brand-primary hover:bg-brand-primary/90 text-background"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Adding…
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Add Ingredient
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
