'use client';

/**
 * Ingredient autocomplete component for the dish editor.
 *
 * Searches `ingredient_aliases` via `searchIngredients()` as the user types,
 * debouncing requests by 300 ms to avoid hammering the DB on every keystroke.
 * Already-selected ingredients are filtered out of the suggestion list.
 *
 * When an ingredient is added or removed the full updated array is passed to
 * `onIngredientsChange` — the parent form stores the array and sends it with
 * the dish payload; a Postgres trigger then auto-calculates allergens and
 * dietary tags from the linked canonical ingredients.
 */

import { useState, useEffect, useRef } from 'react';
import { Check, X, Plus, Sprout, Leaf } from 'lucide-react';
import { searchIngredients, type Ingredient } from '@/lib/ingredients';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { useDebounce } from '@/lib/hooks/useDebounce';

/** Ingredient extended with an optional free-text quantity note (e.g. "100g"). */
interface SelectedIngredient extends Ingredient {
  quantity?: string;
}

interface IngredientAutocompleteProps {
  selectedIngredients: SelectedIngredient[];
  onIngredientsChange: (ingredients: SelectedIngredient[]) => void;
  placeholder?: string;
}

export function IngredientAutocomplete({
  selectedIngredients,
  onIngredientsChange,
  placeholder = 'Search ingredients...',
}: IngredientAutocompleteProps) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  const [suggestions, setSuggestions] = useState<Ingredient[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Search when debounced query changes. Requires at least 2 characters.
  useEffect(() => {
    const search = async () => {
      if (debouncedQuery.trim().length < 2) {
        setSuggestions([]);
        setError(null);
        return;
      }

      setIsLoading(true);
      setError(null);
      const { data, error: searchError } = await searchIngredients(debouncedQuery);

      if (searchError) {
        setError('Failed to search ingredients. Please try again.');
        setSuggestions([]);
      } else if (data) {
        // Filter out already selected ingredients so the dropdown never shows duplicates.
        const filtered = data.filter(
          ing => !selectedIngredients.find(selected => selected.id === ing.id)
        );
        setSuggestions(filtered);
        setIsOpen(true);
      }
      setIsLoading(false);
    };

    search();
  }, [debouncedQuery, selectedIngredients]);

  // Close the dropdown when the user clicks anywhere outside the input or the list.
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectIngredient = (ingredient: Ingredient) => {
    onIngredientsChange([...selectedIngredients, ingredient]);
    setQuery('');
    setSuggestions([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleRemoveIngredient = (ingredientId: string) => {
    onIngredientsChange(selectedIngredients.filter(ing => ing.id !== ingredientId));
  };

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => debouncedQuery.length >= 2 && setIsOpen(true)}
          placeholder={placeholder}
          className="w-full"
          aria-label="Search ingredients"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls="ingredient-suggestions"
        />
        {isLoading && (
          <div className="absolute right-3 top-3">
            <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        )}

        {/* Loading skeleton for initial fetch */}
        {isLoading && debouncedQuery.trim().length >= 2 && suggestions.length === 0 && !error && (
          <div className="absolute z-50 w-full mt-1 bg-background border border rounded-md shadow-lg p-2">
            <LoadingSkeleton variant="card" count={3} />
          </div>
        )}

        {/* Error message */}
        {error && (
          <p className="text-sm text-destructive mt-1">{error}</p>
        )}

        {/* Suggestions Dropdown */}
        {isOpen && suggestions.length > 0 && (
          <div
            ref={dropdownRef}
            id="ingredient-suggestions"
            role="listbox"
            className="absolute z-50 w-full mt-1 bg-background border border rounded-md shadow-lg max-h-60 overflow-auto"
          >
            {suggestions.map(ingredient => (
              <button
                key={ingredient.id}
                onClick={() => handleSelectIngredient(ingredient)}
                role="option"
                className="w-full px-4 py-2 text-left hover:bg-accent flex items-center justify-between group"
              >
                <div className="flex-1">
                  <div className="font-medium text-foreground">{ingredient.display_name}</div>
                  {ingredient.canonical_name && (
                    <div className="text-xs text-muted-foreground">
                      Canonical: {ingredient.canonical_name}
                    </div>
                  )}
                </div>
                <div className="flex gap-1">
                  {ingredient.is_vegetarian && (
                    <Badge variant="secondary" className="text-xs">
                      <Sprout className="h-3 w-3 mr-1" /> Veg
                    </Badge>
                  )}
                  {ingredient.is_vegan && (
                    <Badge variant="secondary" className="text-xs bg-success/10">
                      <Leaf className="h-3 w-3 mr-1" /> Vegan
                    </Badge>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected Ingredients */}
      {selectedIngredients.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Selected Ingredients ({selectedIngredients.length})
          </label>
          <div className="space-y-2">
            {selectedIngredients.map(ingredient => (
              <div
                key={ingredient.id}
                className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg border"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{ingredient.display_name}</span>
                    {ingredient.is_vegetarian && (
                      <Badge variant="secondary" className="text-xs">
                        <Sprout className="h-3 w-3" />
                      </Badge>
                    )}
                    {ingredient.is_vegan && (
                      <Badge variant="secondary" className="text-xs bg-success/10">
                        <Leaf className="h-3 w-3" />
                      </Badge>
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveIngredient(ingredient.id)}
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {selectedIngredients.length === 0 && (
        <div className="text-center py-6 text-muted-foreground text-sm border-2 border-dashed border rounded-lg">
          <Plus className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p>No ingredients added yet</p>
          <p className="text-xs mt-1">Start typing to search for ingredients</p>
        </div>
      )}
    </div>
  );
}
