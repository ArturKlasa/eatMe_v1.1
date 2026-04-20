'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Trash2, GitMerge, RefreshCw, Leaf } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/PageHeader';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { INGREDIENT_FAMILY_COLORS } from '@/lib/ui-constants';

interface MergeTarget {
  id: string;
  modifier: string | null;
  is_default: boolean;
}

interface ReviewVariant {
  id: string;
  concept_id: string;
  modifier: string | null;
  is_default: boolean;
  created_at: string;
  concept: {
    slug: string;
    family: string;
    translations: Record<string, string>;
  };
  variant_translations: Record<string, string>;
  usage_count: number;
  merge_targets: MergeTarget[];
}

const LANGS: Array<{ code: string; label: string }> = [
  { code: 'en', label: 'EN' },
  { code: 'es', label: 'ES' },
  { code: 'pl', label: 'PL' },
];

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

export default function IngredientReviewPage() {
  const [variants, setVariants] = useState<ReviewVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [mergeDialogFor, setMergeDialogFor] = useState<ReviewVariant | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<string>('');
  const [deleteDialogFor, setDeleteDialogFor] = useState<ReviewVariant | null>(null);

  const authHeader = useCallback(async (): Promise<HeadersInit> => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const fetchVariants = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/ingredient-variants/review', {
        headers: await authHeader(),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const body = (await res.json()) as { variants: ReviewVariant[] };
      setVariants(body.variants);
    } catch (err) {
      console.error('[IngredientReview] fetch failed:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to load review queue');
    } finally {
      setLoading(false);
    }
  }, [authHeader]);

  useEffect(() => {
    void fetchVariants();
  }, [fetchVariants]);

  const accept = async (variant: ReviewVariant) => {
    setPendingId(variant.id);
    try {
      const res = await fetch(`/api/admin/ingredient-variants/${variant.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({ needs_review: false }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      toast.success(`Accepted "${variant.modifier ?? variant.concept.slug}"`);
      setVariants(prev => prev.filter(v => v.id !== variant.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to accept variant');
    } finally {
      setPendingId(null);
    }
  };

  const remove = async (variant: ReviewVariant) => {
    setPendingId(variant.id);
    try {
      const res = await fetch(`/api/admin/ingredient-variants/${variant.id}`, {
        method: 'DELETE',
        headers: await authHeader(),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      toast.success(`Deleted "${variant.modifier ?? variant.concept.slug}"`);
      setVariants(prev => prev.filter(v => v.id !== variant.id));
      setDeleteDialogFor(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete variant');
    } finally {
      setPendingId(null);
    }
  };

  const merge = async () => {
    if (!mergeDialogFor || !mergeTargetId) return;
    const source = mergeDialogFor;
    setPendingId(source.id);
    try {
      const res = await fetch(`/api/admin/ingredient-variants/${source.id}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({ target_variant_id: mergeTargetId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      toast.success(`Merged "${source.modifier ?? source.concept.slug}"`);
      setVariants(prev => prev.filter(v => v.id !== source.id));
      setMergeDialogFor(null);
      setMergeTargetId('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to merge variant');
    } finally {
      setPendingId(null);
    }
  };

  const totalVariants = variants.length;
  const totalUsage = useMemo(() => variants.reduce((sum, v) => sum + v.usage_count, 0), [variants]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ingredient Variant Review"
        description="Auto-created variants from menu-scan that need human confirmation."
        actions={
          <Button variant="outline" size="sm" onClick={fetchVariants} disabled={loading}>
            <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            Refresh
          </Button>
        }
      />

      {loading ? (
        <LoadingSkeleton variant="table" />
      ) : totalVariants === 0 ? (
        <EmptyState
          icon={Leaf}
          title="Nothing to review"
          description="No variants are flagged as needing review right now."
        />
      ) : (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            {totalVariants} variant{totalVariants === 1 ? '' : 's'} pending review • referenced by{' '}
            {totalUsage} dish{totalUsage === 1 ? '' : 'es'}
          </div>

          <div className="rounded-lg border bg-background overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-2 font-medium">Concept</th>
                  <th className="px-4 py-2 font-medium">Modifier</th>
                  <th className="px-4 py-2 font-medium">Translations</th>
                  <th className="px-4 py-2 font-medium text-right">Usage</th>
                  <th className="px-4 py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {variants.map(v => {
                  const conceptName = v.concept.translations.en ?? v.concept.slug;
                  return (
                    <tr key={v.id} className="border-t">
                      <td className="px-4 py-3 align-top">
                        <div className="font-medium">{conceptName}</div>
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                          <code>{v.concept.slug}</code>
                          <FamilyBadge family={v.concept.family} />
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        {v.modifier ? (
                          <code className="text-sm">{v.modifier}</code>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="space-y-0.5">
                          {LANGS.map(({ code, label }) => {
                            const value = v.variant_translations[code];
                            return (
                              <div key={code} className="flex items-baseline gap-2 text-xs">
                                <span className="text-muted-foreground w-6">{label}</span>
                                <span className={value ? '' : 'text-muted-foreground italic'}>
                                  {value ?? 'missing'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top text-right">
                        {v.usage_count > 0 ? (
                          <Badge variant="secondary">{v.usage_count}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={pendingId === v.id}
                            onClick={() => accept(v)}
                            title="Accept — clears needs_review"
                          >
                            <Check className="h-4 w-4" />
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={pendingId === v.id || v.merge_targets.length === 0}
                            onClick={() => {
                              setMergeDialogFor(v);
                              setMergeTargetId('');
                            }}
                            title={
                              v.merge_targets.length === 0
                                ? 'No other variants under this concept'
                                : 'Merge into existing variant'
                            }
                          >
                            <GitMerge className="h-4 w-4" />
                            Merge
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={pendingId === v.id}
                            onClick={() => setDeleteDialogFor(v)}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Merge dialog */}
      <Dialog
        open={mergeDialogFor !== null}
        onOpenChange={open => {
          if (!open) {
            setMergeDialogFor(null);
            setMergeTargetId('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge variant</DialogTitle>
            <DialogDescription>
              Move all dish references from{' '}
              <code>{mergeDialogFor?.modifier ?? mergeDialogFor?.concept.slug}</code> into another
              variant, then delete the source. The target must belong to the same concept.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Select value={mergeTargetId} onValueChange={setMergeTargetId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a target variant…" />
              </SelectTrigger>
              <SelectContent>
                {(mergeDialogFor?.merge_targets ?? []).map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.modifier ?? '(default)'}
                    {t.is_default ? ' • default' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setMergeDialogFor(null);
                setMergeTargetId('');
              }}
            >
              Cancel
            </Button>
            <Button onClick={merge} disabled={!mergeTargetId || pendingId === mergeDialogFor?.id}>
              Merge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteDialogFor !== null}
        onOpenChange={open => {
          if (!open) setDeleteDialogFor(null);
        }}
        title="Delete variant"
        description={
          deleteDialogFor
            ? `Delete "${deleteDialogFor.modifier ?? deleteDialogFor.concept.slug}"? ${
                deleteDialogFor.usage_count > 0
                  ? `${deleteDialogFor.usage_count} dish(es) reference it — they will keep the concept-level link but lose the variant specialization.`
                  : 'No dishes reference it.'
              }`
            : ''
        }
        confirmLabel="Delete"
        confirmVariant="destructive"
        onConfirm={() => {
          if (deleteDialogFor) void remove(deleteDialogFor);
        }}
      />
    </div>
  );
}
