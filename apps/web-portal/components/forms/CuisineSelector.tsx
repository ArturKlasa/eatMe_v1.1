'use client';

import { useState, useMemo } from 'react';
import { X } from 'lucide-react';
import { CUISINES, POPULAR_CUISINES } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

export interface CuisineSelectorProps {
  selected: string[];
  onChange: (cuisines: string[]) => void;
  maxDisplay?: number;
}

export function CuisineSelector({ selected, onChange, maxDisplay }: CuisineSelectorProps) {
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);

  const filteredCuisines = useMemo(() => {
    if (search) {
      return CUISINES.filter(c => c.toLowerCase().includes(search.toLowerCase()));
    }
    return showAll ? [...CUISINES] : [];
  }, [search, showAll]);

  const handleToggle = (cuisine: string) => {
    if (selected.includes(cuisine)) {
      onChange(selected.filter(c => c !== cuisine));
    } else {
      onChange([...selected, cuisine]);
    }
  };

  const handleRemove = (cuisine: string) => {
    onChange(selected.filter(c => c !== cuisine));
  };

  const displayedSelected = maxDisplay ? selected.slice(0, maxDisplay) : selected;
  const hiddenCount = maxDisplay ? Math.max(0, selected.length - maxDisplay) : 0;

  return (
    <div className="space-y-4">
      {/* Selected cuisines as badges */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2 p-3 bg-muted/30 rounded-lg">
          {displayedSelected.map(cuisine => (
            <Badge key={cuisine} variant="secondary" className="text-sm">
              {cuisine}
              <button
                type="button"
                onClick={() => handleRemove(cuisine)}
                className="ml-2 hover:text-destructive"
                aria-label={`Remove ${cuisine}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {hiddenCount > 0 && (
            <Badge variant="outline" className="text-sm">
              +{hiddenCount} more
            </Badge>
          )}
        </div>
      )}

      {/* Search input */}
      <Input
        placeholder="Search cuisines..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {/* Popular cuisines (shown when not searching) */}
      {!search && (
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-foreground">
                {showAll ? 'All Cuisines' : 'Most Popular'}
              </h4>
              <button
                type="button"
                onClick={() => setShowAll(!showAll)}
                className="text-sm text-brand-primary hover:text-brand-primary font-medium"
              >
                {showAll ? 'Show Popular' : 'Show All'}
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 p-2 border rounded-lg bg-brand-primary/5">
              {(showAll ? CUISINES : POPULAR_CUISINES).map(cuisine => (
                <div key={cuisine} className="flex items-center space-x-2">
                  <Checkbox
                    id={`cuisine-${cuisine}`}
                    checked={selected.includes(cuisine)}
                    onCheckedChange={() => handleToggle(cuisine)}
                  />
                  <label
                    htmlFor={`cuisine-${cuisine}`}
                    className="text-sm cursor-pointer hover:text-brand-primary font-medium"
                  >
                    {cuisine}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Search results */}
      {search && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-64 overflow-y-auto p-2 border rounded-lg">
          {filteredCuisines.map(cuisine => (
            <div key={cuisine} className="flex items-center space-x-2">
              <Checkbox
                id={`cuisine-search-${cuisine}`}
                checked={selected.includes(cuisine)}
                onCheckedChange={() => handleToggle(cuisine)}
              />
              <label
                htmlFor={`cuisine-search-${cuisine}`}
                className="text-sm cursor-pointer hover:text-brand-primary"
              >
                {cuisine}
              </label>
            </div>
          ))}
          {filteredCuisines.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4 col-span-full">
              No cuisines found matching &quot;{search}&quot;
            </p>
          )}
        </div>
      )}
    </div>
  );
}
