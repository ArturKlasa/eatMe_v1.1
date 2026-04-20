'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, Loader2, Plus, X, Leaf, Sprout } from 'lucide-react';
import { searchIngredients, type Ingredient } from '@/lib/ingredients';
import { cn } from '@/lib/utils';
import type { EditableIngredient } from '@/lib/menu-scan';

interface InlineIngredientSearchProps {
  onAdd: (ingredient: EditableIngredient) => void;
  onClose: () => void;
  /** IDs already on this dish — used to grey out duplicates */
  existingIds?: Set<string>;
}

export function InlineIngredientSearch({
  onAdd,
  onClose,
  existingIds = new Set(),
}: InlineIngredientSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Ingredient[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on outside click
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [onClose]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const { data } = await searchIngredients(query.trim(), 12);
      // Deduplicate by canonical_ingredient_id
      const deduped = data.reduce<Ingredient[]>((acc, item) => {
        if (!acc.find(x => x.canonical_ingredient_id === item.canonical_ingredient_id)) {
          acc.push(item);
        }
        return acc;
      }, []);
      setResults(deduped);
      setOpen(deduped.length > 0);
      setSearching(false);
    }, 220);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function handleSelect(item: Ingredient) {
    if (existingIds.has(item.canonical_ingredient_id)) return;
    onAdd({
      raw_text: item.display_name,
      status: 'matched',
      concept_id: item.concept_id,
      variant_id: item.variant_id ?? null,
      canonical_ingredient_id: item.canonical_ingredient_id,
      canonical_name: item.canonical_name,
      display_name: item.display_name,
    });
    setQuery('');
    setResults([]);
    setOpen(false);
    inputRef.current?.focus();
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-1 border border-orange-300 rounded-lg px-2 py-1 bg-background focus-within:ring-1 focus-within:ring-orange-400">
        <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search ingredient…"
          className="flex-1 text-xs bg-transparent outline-none min-w-0 placeholder:text-muted-foreground"
        />
        {searching ? (
          <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin shrink-0" />
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground shrink-0"
            aria-label="Close search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-30 top-full mt-1 w-56 bg-background border border rounded-lg shadow-lg overflow-hidden">
          {results.map(item => {
            const already = existingIds.has(item.canonical_ingredient_id);
            return (
              <button
                key={item.canonical_ingredient_id}
                type="button"
                disabled={already}
                onClick={() => handleSelect(item)}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 text-left text-xs border-b border last:border-0 transition-colors',
                  already
                    ? 'text-muted-foreground cursor-default'
                    : 'hover:bg-brand-primary/5 text-foreground'
                )}
              >
                <span className="truncate">
                  {item.display_name}
                  <span className="ml-1 text-[10px] uppercase text-muted-foreground">
                    {item.language}
                  </span>
                  {item.is_vegan && <Leaf className="ml-1 h-3 w-3 inline-block text-success" />}
                  {!item.is_vegan && item.is_vegetarian && (
                    <Sprout className="ml-1 h-3 w-3 inline-block text-success" />
                  )}
                </span>
                {!already && <Plus className="h-3 w-3 text-brand-primary/70 shrink-0 ml-1" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
