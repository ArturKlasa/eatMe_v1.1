'use client';

import { useState, useEffect } from 'react';
import { Download, Leaf, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { INGREDIENT_FAMILY_COLORS } from '@/lib/ui-constants';
import { PageHeader } from '@/components/PageHeader';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
} from '@/components/ui/pagination';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useDialog } from '@/hooks/useDialog';
import { usePagination } from '@/hooks/usePagination';
import { useFilters } from '@/hooks/useFilters';

interface CanonicalIngredient {
  id: string;
  canonical_name: string;
  ingredient_family_name?: string;
  is_vegetarian: boolean | null;
  is_vegan: boolean | null;
  created_at: string | null;
}

interface IngredientAlias {
  id: string;
  display_name: string;
  canonical_ingredient_id: string;
  canonical_ingredient?: {
    canonical_name: string;
    ingredient_family_name?: string;
  };
  created_at: string | null;
}

type CanonicalFormData = {
  canonical_name: string;
  ingredient_family_name: string;
  is_vegetarian: boolean;
  is_vegan: boolean;
};

type AliasFormData = {
  display_name: string;
  canonical_ingredient_id: string;
};

const PAGE_SIZE = 25;

const FAMILY_KEYS = Object.keys(INGREDIENT_FAMILY_COLORS);

function FamilyBadge({ family }: { family?: string }) {
  const f = family ?? 'other';
  const colors = INGREDIENT_FAMILY_COLORS[f] ?? INGREDIENT_FAMILY_COLORS.other;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors.bg} ${colors.text}`}
    >
      {f.replace(/_/g, ' ')}
    </span>
  );
}

export default function IngredientsPage() {
  const [activeTab, setActiveTab] = useState<'canonical' | 'aliases'>('aliases');
  const [canonicalIngredients, setCanonicalIngredients] = useState<CanonicalIngredient[]>([]);
  const [aliases, setAliases] = useState<IngredientAlias[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmState, setConfirmState] = useState<{
    open: boolean; title: string; description: string; onConfirm: () => void;
  }>({ open: false, title: '', description: '', onConfirm: () => {} });

  // Dialog hooks — replace showCanonicalForm+canonicalFormData and showAliasForm+aliasFormData
  const canonicalDialog = useDialog<CanonicalFormData>();
  const aliasDialog = useDialog<AliasFormData>();

  // Filter hooks — replace inline filter logic
  const filteredCanonical = useFilters<CanonicalIngredient>(canonicalIngredients, [
    {
      value: searchQuery,
      fn: (ing, q) => ing.canonical_name.toLowerCase().includes(q.toLowerCase()),
    },
  ]);

  const filteredAliases = useFilters<IngredientAlias>(aliases, [
    {
      value: searchQuery,
      fn: (alias, q) =>
        alias.display_name.toLowerCase().includes(q.toLowerCase()) ||
        (alias.canonical_ingredient?.canonical_name.toLowerCase().includes(q.toLowerCase()) ?? false) ||
        (alias.canonical_ingredient?.ingredient_family_name
          ?.toLowerCase()
          .includes(q.toLowerCase()) ?? false),
    },
  ]);

  const currentItems = (
    activeTab === 'canonical' ? filteredCanonical : filteredAliases
  ) as (CanonicalIngredient | IngredientAlias)[];

  // Pagination hook — replaces manual page state + slice logic (auto-resets on items.length change)
  const { page, totalPages, paginatedItems, setPage, hasPrev, hasNext } = usePagination(
    currentItems,
    PAGE_SIZE
  );

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: canonicalData, error: canonicalError } = await supabase
        .from('canonical_ingredients')
        .select('*')
        .order('canonical_name');

      if (canonicalError) throw canonicalError;

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
    if (!canonicalDialog.data) return;
    const { canonical_name, ingredient_family_name, is_vegetarian, is_vegan } = canonicalDialog.data;
    try {
      const { error } = await supabase.from('canonical_ingredients').insert({
        canonical_name: canonical_name.toLowerCase().replace(/\s+/g, '_'),
        ingredient_family_name,
        is_vegetarian,
        is_vegan,
      });

      if (error) throw error;

      toast.success('Canonical ingredient added successfully');
      canonicalDialog.close();
      fetchData();
    } catch (error: unknown) {
      console.error('Error adding canonical ingredient:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Failed to add: ' + message);
    }
  };

  const handleSubmitAlias = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aliasDialog.data) return;
    const { display_name, canonical_ingredient_id } = aliasDialog.data;
    try {
      const { error } = await supabase.from('ingredient_aliases').insert({
        display_name,
        canonical_ingredient_id,
      });

      if (error) throw error;

      toast.success('Alias added successfully');
      aliasDialog.close();
      fetchData();
    } catch (error: unknown) {
      console.error('Error adding alias:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Failed to add: ' + message);
    }
  };

  const handleDeleteCanonical = (id: string, name: string) => {
    setConfirmState({
      open: true,
      title: 'Delete Canonical Ingredient',
      description: `Delete "${name}"? This will also delete all its aliases. This action cannot be undone.`,
      onConfirm: async () => {
        setConfirmState(s => ({ ...s, open: false }));
        try {
          const { error } = await supabase.from('canonical_ingredients').delete().eq('id', id);
          if (error) throw error;
          toast.success('Canonical ingredient deleted');
          fetchData();
        } catch (error: unknown) {
          console.error('Error deleting:', error);
          const message = error instanceof Error ? error.message : 'Unknown error';
          toast.error('Failed to delete: ' + message);
        }
      },
    });
  };

  const handleDeleteAlias = (id: string, name: string) => {
    setConfirmState({
      open: true,
      title: 'Delete Alias',
      description: `Delete alias "${name}"? This action cannot be undone.`,
      onConfirm: async () => {
        setConfirmState(s => ({ ...s, open: false }));
        try {
          const { error } = await supabase.from('ingredient_aliases').delete().eq('id', id);
          if (error) throw error;
          toast.success('Alias deleted');
          fetchData();
        } catch (error: unknown) {
          console.error('Error deleting:', error);
          const message = error instanceof Error ? error.message : 'Unknown error';
          toast.error('Failed to delete: ' + message);
        }
      },
    });
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

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <PageHeader title="Ingredients" description="Manage canonical ingredients and their display aliases" />
        <LoadingSkeleton variant="table" count={8} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <PageHeader
        title="Ingredients"
        description="Manage canonical ingredients and their display aliases"
        badge={{ label: `${canonicalIngredients.length} canonical, ${aliases.length} aliases`, variant: 'default' }}
      />

      {/* Tabs */}
      <div className="border-b mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('aliases')}
            className={`${
              activeTab === 'aliases'
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-input'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Display Names ({aliases.length})
          </button>
          <button
            onClick={() => setActiveTab('canonical')}
            className={`${
              activeTab === 'canonical'
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-input'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Canonical Ingredients ({canonicalIngredients.length})
          </button>
        </nav>
      </div>

      {/* Search and Add Button */}
      <div className="flex justify-between items-center mb-6">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button
            onClick={() =>
              activeTab === 'canonical'
                ? canonicalDialog.open({
                    canonical_name: '',
                    ingredient_family_name: 'other',
                    is_vegetarian: true,
                    is_vegan: false,
                  })
                : aliasDialog.open({ display_name: '', canonical_ingredient_id: '' })
            }
          >
            + Add {activeTab === 'canonical' ? 'Canonical' : 'Alias'}
          </Button>
        </div>
      </div>

      {/* Canonical Ingredients Tab */}
      {activeTab === 'canonical' && (
        currentItems.length === 0 ? (
          <EmptyState
            icon={Leaf}
            title="No canonical ingredients found"
            description={searchQuery ? 'Try a different search term.' : 'Add your first canonical ingredient.'}
            action={!searchQuery ? { label: 'Add Canonical', onClick: () => canonicalDialog.open({ canonical_name: '', ingredient_family_name: 'other', is_vegetarian: true, is_vegan: false }) } : undefined}
          />
        ) : (
          <div className="bg-card rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y">
              <thead className="bg-muted/30">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Canonical Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Family
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Vegetarian
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Vegan
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y">
                {(paginatedItems as CanonicalIngredient[]).map(ingredient => (
                  <tr key={ingredient.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                      {ingredient.canonical_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <FamilyBadge family={ingredient.ingredient_family_name} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {ingredient.is_vegetarian ? '✓' : '✗'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {ingredient.is_vegan ? '✓' : '✗'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() =>
                          handleDeleteCanonical(ingredient.id, ingredient.canonical_name)
                        }
                        className="text-destructive hover:text-destructive/80"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Aliases Tab */}
      {activeTab === 'aliases' && (
        currentItems.length === 0 ? (
          <EmptyState
            icon={Leaf}
            title="No display name aliases found"
            description={searchQuery ? 'Try a different search term.' : 'Add your first display name alias.'}
            action={!searchQuery ? { label: 'Add Alias', onClick: () => aliasDialog.open({ display_name: '', canonical_ingredient_id: '' }) } : undefined}
          />
        ) : (
          <div className="bg-card rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y">
              <thead className="bg-muted/30">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Display Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    → Canonical Ingredient
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Family
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y">
                {(paginatedItems as IngredientAlias[]).map(alias => (
                  <tr key={alias.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                      {alias.display_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {alias.canonical_ingredient?.canonical_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <FamilyBadge family={alias.canonical_ingredient?.ingredient_family_name} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleDeleteAlias(alias.id, alias.display_name)}
                        className="text-destructive hover:text-destructive/80"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-muted-foreground">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, currentItems.length)} of{' '}
            {currentItems.length}
          </span>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setPage(page - 1)}
                  aria-disabled={!hasPrev}
                  className={!hasPrev ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .map((p, idx, arr) => (
                  <PaginationItem key={p}>
                    {idx > 0 && arr[idx - 1] !== p - 1 && (
                      <span className="px-2 text-muted-foreground">...</span>
                    )}
                    <PaginationLink
                      onClick={() => setPage(p)}
                      isActive={p === page}
                      className="cursor-pointer"
                    >
                      {p}
                    </PaginationLink>
                  </PaginationItem>
                ))}
              <PaginationItem>
                <PaginationNext
                  onClick={() => setPage(page + 1)}
                  aria-disabled={!hasNext}
                  className={!hasNext ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {/* Canonical Ingredient Form Dialog */}
      <Dialog
        open={canonicalDialog.isOpen}
        onOpenChange={(open) => { if (!open) canonicalDialog.reset(); }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Canonical Ingredient</DialogTitle>
            <DialogDescription>
              Create a new canonical ingredient entry.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitCanonical}>
            <div className="space-y-4 py-2">
              <div>
                <Label htmlFor="canonical-name">
                  Canonical Name (lowercase_snake_case) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="canonical-name"
                  required
                  value={canonicalDialog.data?.canonical_name ?? ''}
                  onChange={e =>
                    canonicalDialog.data &&
                    canonicalDialog.open({ ...canonicalDialog.data, canonical_name: e.target.value })
                  }
                  placeholder="e.g., beef, tomato, olive_oil"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Will be converted to lowercase with underscores
                </p>
              </div>

              <div>
                <Label htmlFor="canonical-family">Family</Label>
                <select
                  id="canonical-family"
                  value={canonicalDialog.data?.ingredient_family_name ?? 'other'}
                  onChange={e =>
                    canonicalDialog.data &&
                    canonicalDialog.open({
                      ...canonicalDialog.data,
                      ingredient_family_name: e.target.value,
                    })
                  }
                  className="mt-1 w-full px-3 py-2 border border-input rounded-lg text-sm"
                >
                  {FAMILY_KEYS.map(f => (
                    <option key={f} value={f}>
                      {f.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3">
                <Checkbox
                  id="canonical-vegetarian"
                  checked={canonicalDialog.data?.is_vegetarian ?? true}
                  onCheckedChange={val =>
                    canonicalDialog.data &&
                    canonicalDialog.open({
                      ...canonicalDialog.data,
                      is_vegetarian: val === true,
                    })
                  }
                />
                <Label htmlFor="canonical-vegetarian" className="cursor-pointer font-normal">
                  Vegetarian
                </Label>
              </div>

              <div className="flex items-center gap-3">
                <Checkbox
                  id="canonical-vegan"
                  checked={canonicalDialog.data?.is_vegan ?? false}
                  onCheckedChange={val =>
                    canonicalDialog.data &&
                    canonicalDialog.open({ ...canonicalDialog.data, is_vegan: val === true })
                  }
                />
                <Label htmlFor="canonical-vegan" className="cursor-pointer font-normal">
                  Vegan
                </Label>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => canonicalDialog.close()}>
                Cancel
              </Button>
              <Button type="submit">Add</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Alias Form Dialog */}
      <Dialog
        open={aliasDialog.isOpen}
        onOpenChange={(open) => { if (!open) aliasDialog.reset(); }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Display Name (Alias)</DialogTitle>
            <DialogDescription>
              Map a display name to a canonical ingredient.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitAlias}>
            <div className="space-y-4 py-2">
              <div>
                <Label htmlFor="alias-name">
                  Display Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="alias-name"
                  required
                  value={aliasDialog.data?.display_name ?? ''}
                  onChange={e =>
                    aliasDialog.data &&
                    aliasDialog.open({ ...aliasDialog.data, display_name: e.target.value })
                  }
                  placeholder="e.g., Ground Beef, Roma Tomato, EVOO"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="alias-canonical">
                  Maps to Canonical Ingredient <span className="text-destructive">*</span>
                </Label>
                <select
                  id="alias-canonical"
                  required
                  value={aliasDialog.data?.canonical_ingredient_id ?? ''}
                  onChange={e =>
                    aliasDialog.data &&
                    aliasDialog.open({ ...aliasDialog.data, canonical_ingredient_id: e.target.value })
                  }
                  className="mt-1 w-full px-3 py-2 border border-input rounded-lg text-sm"
                >
                  <option value="">Select canonical ingredient...</option>
                  {canonicalIngredients.map(ing => (
                    <option key={ing.id} value={ing.id}>
                      {ing.canonical_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => aliasDialog.close()}>
                Cancel
              </Button>
              <Button type="submit">Add</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmState.open}
        onOpenChange={(open) => setConfirmState(s => ({ ...s, open }))}
        title={confirmState.title}
        description={confirmState.description}
        onConfirm={confirmState.onConfirm}
      />
    </div>
  );
}
