'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/PageHeader';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { INGREDIENT_FAMILY_COLORS } from '@/lib/ui-constants';

interface ConceptRow {
  id: string;
  slug: string;
  family: string;
  is_vegetarian: boolean;
  is_vegan: boolean;
  allergens: string[];
  name_en: string | null;
  variant_count: number;
  alias_count: number;
}

const PAGE_SIZE = 25;
const FAMILY_KEYS = Object.keys(INGREDIENT_FAMILY_COLORS);

function FamilyBadge({ family }: { family: string }) {
  const colors = INGREDIENT_FAMILY_COLORS[family] ?? INGREDIENT_FAMILY_COLORS.other;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors.bg} ${colors.text}`}
    >
      {family.replace(/_/g, ' ')}
    </span>
  );
}

export default function IngredientsPage() {
  const [concepts, setConcepts] = useState<ConceptRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [family, setFamily] = useState<string>('all');
  const [page, setPage] = useState(1);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  // Debounce search input so every keystroke doesn't fire a query.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Reset to page 1 whenever filters change.
  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, family]);

  const authHeader = useCallback(async (): Promise<HeadersInit> => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const fetchConcepts = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (debouncedQuery) qs.set('q', debouncedQuery);
      if (family !== 'all') qs.set('family', family);
      qs.set('page', String(page));
      qs.set('pageSize', String(PAGE_SIZE));
      const res = await fetch(`/api/admin/ingredient-concepts?${qs.toString()}`, {
        headers: await authHeader(),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const body = (await res.json()) as { concepts: ConceptRow[]; total: number };
      setConcepts(body.concepts);
      setTotal(body.total);
    } catch (err) {
      console.error('[Ingredients] fetch failed:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to load ingredients');
    } finally {
      setLoading(false);
    }
  }, [authHeader, debouncedQuery, family, page]);

  useEffect(() => {
    void fetchConcepts();
  }, [fetchConcepts]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ingredients"
        description="Browse and edit ingredient concepts, translations, variants, and aliases."
      />

      <div className="flex flex-col md:flex-row gap-3 md:items-end">
        <div className="flex-1">
          <Label htmlFor="search" className="mb-1.5 block">
            Search (all languages)
          </Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              id="search"
              className="pl-9"
              placeholder="e.g. salmon, jitomate, łosoś…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="md:w-48">
          <Label htmlFor="family" className="mb-1.5 block">
            Family
          </Label>
          <Select value={family} onValueChange={setFamily}>
            <SelectTrigger id="family">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {FAMILY_KEYS.map(f => (
                <SelectItem key={f} value={f}>
                  {f.replace(/_/g, ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <LoadingSkeleton variant="table" />
      ) : concepts.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground text-sm">
          No concepts match the current filters.
        </div>
      ) : (
        <>
          <div className="text-sm text-muted-foreground">
            {total} concept{total === 1 ? '' : 's'} • page {page} of {totalPages}
          </div>

          <div className="rounded-lg border bg-background overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Family</th>
                  <th className="px-4 py-2 font-medium text-right">Variants</th>
                  <th className="px-4 py-2 font-medium text-right">Aliases</th>
                </tr>
              </thead>
              <tbody>
                {concepts.map(c => (
                  <tr key={c.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/ingredients/${c.id}`}
                        className="font-medium hover:underline"
                      >
                        {c.name_en ?? c.slug}
                      </Link>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        <code>{c.slug}</code>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <FamilyBadge family={c.family} />
                    </td>
                    <td className="px-4 py-3 text-right">{c.variant_count}</td>
                    <td className="px-4 py-3 text-right">{c.alias_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground px-2">
                {page} / {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
