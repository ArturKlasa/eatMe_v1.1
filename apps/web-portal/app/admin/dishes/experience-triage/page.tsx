'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Utensils, BookOpen } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/EmptyState';

interface LegacyDish {
  id: string;
  name: string;
  description: string | null;
  dish_kind: string;
}

type TargetKind = 'course_menu' | 'buffet';

const BUFFET_KEYWORDS = ['ayce', 'buffet', 'all you can eat', 'all-you-can-eat'];
const COURSE_KEYWORDS = [
  'tasting',
  'prix fixe',
  'prix-fixe',
  'degustation',
  'dégustation',
  'set menu',
  'course',
];

function autoClassify(dish: LegacyDish): TargetKind {
  const text = `${dish.name} ${dish.description ?? ''}`.toLowerCase();
  if (BUFFET_KEYWORDS.some(kw => text.includes(kw))) return 'buffet';
  if (COURSE_KEYWORDS.some(kw => text.includes(kw))) return 'course_menu';
  return 'course_menu';
}

const LEGACY_KINDS = ['experience', 'template', 'combo'];

export default function ExperienceTriagePage() {
  const router = useRouter();
  const [dishes, setDishes] = useState<LegacyDish[]>([]);
  const [selections, setSelections] = useState<Record<string, TargetKind>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const authHeader = useCallback(async (): Promise<HeadersInit> => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('dishes')
        .select('id, name, description, dish_kind')
        .in('dish_kind', LEGACY_KINDS)
        .order('name');

      if (error) {
        toast.error('Failed to load legacy dishes: ' + error.message);
        setLoading(false);
        return;
      }

      const rows = (data ?? []) as LegacyDish[];

      if (rows.length === 0) {
        router.replace('/admin');
        return;
      }

      const initial: Record<string, TargetKind> = {};
      for (const d of rows) {
        initial[d.id] = 'course_menu';
      }
      setDishes(rows);
      setSelections(initial);
      setLoading(false);
    };

    load();
  }, [router]);

  const handleBulkAutoClassify = () => {
    const next: Record<string, TargetKind> = {};
    for (const d of dishes) {
      next[d.id] = autoClassify(d);
    }
    setSelections(next);
    toast.success(
      'Auto-classified ' + dishes.length + ' dishes based on name/description keywords'
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const entries = dishes.map(d => ({
        dish_id: d.id,
        before_kind: d.dish_kind,
        after_kind: selections[d.id] ?? 'course_menu',
      }));

      const res = await fetch('/api/admin/dishes/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify(entries),
      });

      const json = (await res.json()) as { updated?: number; errors?: string[]; error?: string };

      if (!res.ok) {
        toast.error('Triage failed: ' + (json.error ?? 'unknown error'));
        return;
      }

      toast.success(`Triaged ${json.updated ?? 0} dishes successfully`);
      if (json.errors?.length) {
        toast.warning(`${json.errors.length} dish(es) failed to update`);
      }

      router.replace('/admin');
    } catch (err) {
      toast.error('Unexpected error: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (dishes.length === 0) {
    return (
      <EmptyState
        icon={Utensils}
        title="No legacy dishes"
        description="All experience-type dishes have been triaged."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Experience Dish Triage"
        description={`${dishes.length} legacy dish(es) with kind 'experience', 'template', or 'combo' need reclassification before the kind check can be tightened.`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleBulkAutoClassify} disabled={saving}>
              Auto-classify all
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save triage
            </Button>
          </div>
        }
      />

      <div className="rounded-lg border bg-background overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="px-4 py-3 text-left font-medium text-foreground">Dish name</th>
              <th className="px-4 py-3 text-left font-medium text-foreground">Current kind</th>
              <th className="px-4 py-3 text-left font-medium text-foreground">Description</th>
              <th className="px-4 py-3 text-center font-medium text-foreground">
                <span className="flex items-center justify-center gap-1">
                  <BookOpen className="h-3.5 w-3.5" />
                  Course menu
                </span>
              </th>
              <th className="px-4 py-3 text-center font-medium text-foreground">
                <span className="flex items-center justify-center gap-1">
                  <Utensils className="h-3.5 w-3.5" />
                  Buffet
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {dishes.map((dish, idx) => (
              <tr key={dish.id} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/10'}>
                <td className="px-4 py-3 font-medium text-foreground">{dish.name}</td>
                <td className="px-4 py-3">
                  <span className="text-xs px-2 py-0.5 rounded bg-warning/10 text-warning border border-warning/20">
                    {dish.dish_kind}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">
                  {dish.description ?? '—'}
                </td>
                <td className="px-4 py-3 text-center">
                  <input
                    type="radio"
                    name={`kind-${dish.id}`}
                    value="course_menu"
                    checked={selections[dish.id] === 'course_menu'}
                    onChange={() => setSelections(prev => ({ ...prev, [dish.id]: 'course_menu' }))}
                    className="h-4 w-4 text-brand-primary border-input focus:ring-brand-primary"
                    aria-label={`Set ${dish.name} to course_menu`}
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  <input
                    type="radio"
                    name={`kind-${dish.id}`}
                    value="buffet"
                    checked={selections[dish.id] === 'buffet'}
                    onChange={() => setSelections(prev => ({ ...prev, [dish.id]: 'buffet' }))}
                    className="h-4 w-4 text-brand-primary border-input focus:ring-brand-primary"
                    aria-label={`Set ${dish.name} to buffet`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
