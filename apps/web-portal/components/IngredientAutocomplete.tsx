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
import { Check, X, Plus } from 'lucide-react';
import { searchIngredients, type Ingredient } from '@/lib/ingredients';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

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
  const [suggestions, setSuggestions] = useState<Ingredient[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounced search: wait 300 ms after the user stops typing before hitting the DB.
  // Requires at least 2 characters to avoid returning the entire ingredient table.
  useEffect(() => {
    const search = async () => {
      if (query.trim().length < 2) {
        setSuggestions([]);
        return;
      }

      setIsLoading(true);
      const { data, error } = await searchIngredients(query);

      if (!error && data) {
        // Filter out already selected ingredients so the dropdown never shows duplicates.
        const filtered = data.filter(
          ing => !selectedIngredients.find(selected => selected.id === ing.id)
        );
        setSuggestions(filtered);
        setIsOpen(true);
      }
      setIsLoading(false);
    };

    const debounce = setTimeout(search, 300);
    return () => clearTimeout(debounce);
  }, [query, selectedIngredients]);

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
          onFocus={() => query.length >= 2 && setIsOpen(true)}
          placeholder={placeholder}
          className="w-full"
        />
        {isLoading && (
          <div className="absolute right-3 top-3">
            <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        )}

        {/* Suggestions Dropdown */}
        {isOpen && suggestions.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto"
          >
            {suggestions.map(ingredient => (
              <button
                key={ingredient.id}
                onClick={() => handleSelectIngredient(ingredient)}
                className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center justify-between group"
              >
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{ingredient.display_name}</div>
                  {ingredient.canonical_name && (
                    <div className="text-xs text-gray-500">
                      Canonical: {ingredient.canonical_name}
                    </div>
                  )}
                </div>
                <div className="flex gap-1">
                  {ingredient.is_vegetarian && (
                    <Badge variant="secondary" className="text-xs">
                      🥬 Veg
                    </Badge>
                  )}
                  {ingredient.is_vegan && (
                    <Badge variant="secondary" className="text-xs bg-green-100">
                      🌱 Vegan
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
          <label className="text-sm font-medium text-gray-700">
            Selected Ingredients ({selectedIngredients.length})
          </label>
          <div className="space-y-2">
            {selectedIngredients.map(ingredient => (
              <div
                key={ingredient.id}
                className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{ingredient.display_name}</span>
                    {ingredient.is_vegetarian && (
                      <Badge variant="secondary" className="text-xs">
                        🥬
                      </Badge>
                    )}
                    {ingredient.is_vegan && (
                      <Badge variant="secondary" className="text-xs bg-green-100">
                        🌱
                      </Badge>
                    )}
                    {ingredient.is_vegan && <span className="text-xs">🌱</span>}
                    {ingredient.is_vegetarian && !ingredient.is_vegan && (
                      <span className="text-xs">🥗</span>
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveIngredient(ingredient.id)}
                  className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
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
        <div className="text-center py-6 text-gray-500 text-sm border-2 border-dashed border-gray-200 rounded-lg">
          <Plus className="h-8 w-8 mx-auto mb-2 text-gray-400" />
          <p>No ingredients added yet</p>
          <p className="text-xs mt-1">Start typing to search for ingredients</p>
        </div>
      )}
    </div>
  );
}
