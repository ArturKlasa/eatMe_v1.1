'use client';

import { useCallback, useEffect, useState, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Trash2, Plus, Check, X, Star, StarOff } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/PageHeader';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { INGREDIENT_FAMILY_COLORS } from '@/lib/ui-constants';

interface Concept {
  id: string;
  slug: string;
  family: string;
  is_vegetarian: boolean;
  is_vegan: boolean;
  allergens: string[];
  created_at: string;
  updated_at: string;
}

interface Variant {
  id: string;
  modifier: string | null;
  is_default: boolean;
  needs_review: boolean;
  created_at: string;
  translations: Record<string, string>;
}

interface Alias {
  id: string;
  alias_text: string;
  language: string;
  variant_id: string | null;
}

interface DetailPayload {
  concept: Concept;
  translations: Record<string, string>;
  variants: Variant[];
  aliases: Alias[];
}

const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'pl', label: 'Polski' },
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

function useAuthHeader() {
  return useCallback(async (): Promise<HeadersInit> => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);
}

export default function IngredientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const authHeader = useAuthHeader();
  const [data, setData] = useState<DetailPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/ingredient-concepts/${id}`, {
        headers: await authHeader(),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setData((await res.json()) as DetailPayload);
    } catch (err) {
      console.error('[IngredientDetail] fetch failed:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to load concept');
    } finally {
      setLoading(false);
    }
  }, [id, authHeader]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (loading && !data) {
    return <LoadingSkeleton variant="page" />;
  }
  if (!data) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        Concept not found.{' '}
        <Link href="/admin/ingredients" className="underline">
          Back to list
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={data.translations.en ?? data.concept.slug}
        actions={
          <Link href="/admin/ingredients">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          </Link>
        }
      />
      <div className="-mt-4 flex items-center gap-2 flex-wrap text-sm">
        <code>{data.concept.slug}</code>
        <FamilyBadge family={data.concept.family} />
        {data.concept.is_vegetarian && <Badge variant="secondary">vegetarian</Badge>}
        {data.concept.is_vegan && <Badge variant="secondary">vegan</Badge>}
        {data.concept.allergens.map(a => (
          <Badge key={a} variant="destructive">
            {a}
          </Badge>
        ))}
      </div>

      <TranslationsPanel
        conceptId={id}
        translations={data.translations}
        authHeader={authHeader}
        onChange={fetchData}
      />
      <VariantsPanel
        conceptId={id}
        variants={data.variants}
        authHeader={authHeader}
        onChange={fetchData}
      />
      <AliasesPanel
        conceptId={id}
        aliases={data.aliases}
        variants={data.variants}
        authHeader={authHeader}
        onChange={fetchData}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Translations panel
// ---------------------------------------------------------------------------

function TranslationsPanel({
  conceptId,
  translations,
  authHeader,
  onChange,
}: {
  conceptId: string;
  translations: Record<string, string>;
  authHeader: () => Promise<HeadersInit>;
  onChange: () => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>(translations);
  const [savingLang, setSavingLang] = useState<string | null>(null);

  useEffect(() => {
    setDrafts(translations);
  }, [translations]);

  const save = async (lang: string) => {
    setSavingLang(lang);
    try {
      const res = await fetch(`/api/admin/ingredient-concepts/${conceptId}/translations`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({ language: lang, name: drafts[lang] ?? '' }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      toast.success(`Saved ${lang.toUpperCase()} translation`);
      onChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingLang(null);
    }
  };

  return (
    <section className="rounded-lg border bg-background p-4 space-y-3">
      <h2 className="font-semibold">Concept translations</h2>
      <div className="grid gap-3 md:grid-cols-3">
        {LANGS.map(({ code, label }) => {
          const original = translations[code] ?? '';
          const current = drafts[code] ?? '';
          const dirty = current !== original;
          return (
            <div key={code} className="space-y-1.5">
              <Label htmlFor={`tr-${code}`}>{label}</Label>
              <div className="flex gap-1">
                <Input
                  id={`tr-${code}`}
                  value={current}
                  onChange={e => setDrafts(d => ({ ...d, [code]: e.target.value }))}
                  placeholder={code === 'en' ? 'English name…' : 'Optional'}
                />
                <Button
                  size="sm"
                  variant={dirty ? 'default' : 'outline'}
                  disabled={!dirty || savingLang === code}
                  onClick={() => save(code)}
                >
                  <Check className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Variants panel
// ---------------------------------------------------------------------------

function VariantsPanel({
  conceptId,
  variants,
  authHeader,
  onChange,
}: {
  conceptId: string;
  variants: Variant[];
  authHeader: () => Promise<HeadersInit>;
  onChange: () => void;
}) {
  const [newModifier, setNewModifier] = useState('');
  const [creating, setCreating] = useState(false);

  const createVariant = async () => {
    const modifier = newModifier.trim();
    if (!modifier) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/admin/ingredient-concepts/${conceptId}/variants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({ modifier, is_default: false }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      toast.success(`Created variant "${modifier}"`);
      setNewModifier('');
      onChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setCreating(false);
    }
  };

  return (
    <section className="rounded-lg border bg-background p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Variants ({variants.length})</h2>
        <div className="flex gap-2">
          <Input
            className="w-48"
            placeholder="New modifier (e.g. smoked)…"
            value={newModifier}
            onChange={e => setNewModifier(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') void createVariant();
            }}
          />
          <Button size="sm" disabled={!newModifier.trim() || creating} onClick={createVariant}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        {variants.map(v => (
          <VariantRow key={v.id} variant={v} authHeader={authHeader} onChange={onChange} />
        ))}
      </div>
    </section>
  );
}

function VariantRow({
  variant,
  authHeader,
  onChange,
}: {
  variant: Variant;
  authHeader: () => Promise<HeadersInit>;
  onChange: () => void;
}) {
  const [modifierDraft, setModifierDraft] = useState(variant.modifier ?? '');
  const [translationDrafts, setTranslationDrafts] = useState<Record<string, string>>(
    variant.translations
  );
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setModifierDraft(variant.modifier ?? '');
    setTranslationDrafts(variant.translations);
  }, [variant]);

  const modifierDirty = (modifierDraft.trim() || null) !== variant.modifier;

  const patch = async (body: Record<string, unknown>) => {
    setPending(true);
    try {
      const res = await fetch(`/api/admin/ingredient-variants/${variant.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const resp = await res.json().catch(() => ({}));
        throw new Error(resp.error ?? `HTTP ${res.status}`);
      }
      onChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setPending(false);
    }
  };

  const saveModifier = () =>
    patch({ modifier: modifierDraft.trim() || null }).then(() => toast.success('Modifier updated'));

  const toggleDefault = async () => {
    if (variant.is_default) {
      toast.info('Promote another variant to take over default.');
      return;
    }
    await patch({ is_default: true });
    toast.success('Set as default');
  };

  const remove = async () => {
    if (variant.is_default) {
      toast.error('Cannot delete default variant');
      return;
    }
    setPending(true);
    try {
      const res = await fetch(`/api/admin/ingredient-variants/${variant.id}`, {
        method: 'DELETE',
        headers: await authHeader(),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      toast.success('Variant deleted');
      onChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setPending(false);
    }
  };

  const saveTranslation = async (lang: string) => {
    setPending(true);
    try {
      const res = await fetch(`/api/admin/ingredient-variants/${variant.id}/translations`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({ language: lang, name: translationDrafts[lang] ?? '' }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      toast.success(`Saved ${lang.toUpperCase()}`);
      onChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="rounded border p-3 space-y-3 bg-muted/20">
      <div className="flex items-start gap-3">
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <Label className="text-xs text-muted-foreground">Modifier</Label>
            {variant.is_default && <Badge variant="secondary">default</Badge>}
            {variant.needs_review && <Badge variant="destructive">needs review</Badge>}
          </div>
          <div className="flex gap-1">
            <Input
              value={modifierDraft}
              placeholder="(default variant — leave blank)"
              onChange={e => setModifierDraft(e.target.value)}
              disabled={variant.is_default}
            />
            {!variant.is_default && (
              <Button
                size="sm"
                variant={modifierDirty ? 'default' : 'outline'}
                disabled={!modifierDirty || pending}
                onClick={saveModifier}
              >
                <Check className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <div className="flex gap-1 pt-6">
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={toggleDefault}
            title={variant.is_default ? 'Currently the default' : 'Promote to default'}
          >
            {variant.is_default ? (
              <Star className="h-4 w-4 fill-current" />
            ) : (
              <StarOff className="h-4 w-4" />
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending || variant.is_default}
            onClick={remove}
            title={variant.is_default ? 'Cannot delete default' : 'Delete variant'}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        {LANGS.map(({ code, label }) => {
          const original = variant.translations[code] ?? '';
          const current = translationDrafts[code] ?? '';
          const dirty = current !== original;
          return (
            <div key={code} className="space-y-1">
              <Label className="text-xs text-muted-foreground">{label}</Label>
              <div className="flex gap-1">
                <Input
                  value={current}
                  placeholder="—"
                  onChange={e => setTranslationDrafts(d => ({ ...d, [code]: e.target.value }))}
                />
                <Button
                  size="sm"
                  variant={dirty ? 'default' : 'outline'}
                  disabled={!dirty || pending}
                  onClick={() => saveTranslation(code)}
                >
                  <Check className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Aliases panel
// ---------------------------------------------------------------------------

function AliasesPanel({
  conceptId,
  aliases,
  variants,
  authHeader,
  onChange,
}: {
  conceptId: string;
  aliases: Alias[];
  variants: Variant[];
  authHeader: () => Promise<HeadersInit>;
  onChange: () => void;
}) {
  const [newText, setNewText] = useState('');
  const [newLang, setNewLang] = useState('en');
  const [newVariant, setNewVariant] = useState<string>('concept');
  const [creating, setCreating] = useState(false);

  const add = async () => {
    const alias_text = newText.trim().toLowerCase();
    if (!alias_text) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/admin/ingredient-concepts/${conceptId}/aliases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({
          alias_text,
          language: newLang,
          variant_id: newVariant === 'concept' ? null : newVariant,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      toast.success(`Added alias "${alias_text}"`);
      setNewText('');
      onChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Add failed');
    } finally {
      setCreating(false);
    }
  };

  const remove = async (alias: Alias) => {
    try {
      const res = await fetch(`/api/admin/ingredient-aliases/${alias.id}`, {
        method: 'DELETE',
        headers: await authHeader(),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      toast.success(`Deleted "${alias.alias_text}"`);
      onChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const grouped: Record<string, Alias[]> = {};
  for (const a of aliases) {
    (grouped[a.language] ??= []).push(a);
  }
  const langs = Object.keys(grouped).sort();

  const variantLabel = (variantId: string | null) => {
    if (!variantId) return '';
    const v = variants.find(x => x.id === variantId);
    return v?.modifier ?? '(variant)';
  };

  return (
    <section className="rounded-lg border bg-background p-4 space-y-3">
      <h2 className="font-semibold">Aliases ({aliases.length})</h2>

      <div className="flex flex-wrap items-end gap-2 rounded border p-3 bg-muted/20">
        <div className="flex-1 min-w-48">
          <Label className="text-xs text-muted-foreground">Alias text</Label>
          <Input
            value={newText}
            placeholder="e.g. smoked salmon, łosoś, jitomate…"
            onChange={e => setNewText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') void add();
            }}
          />
        </div>
        <div className="w-32">
          <Label className="text-xs text-muted-foreground">Language</Label>
          <Select value={newLang} onValueChange={setNewLang}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGS.map(l => (
                <SelectItem key={l.code} value={l.code}>
                  {l.code.toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-44">
          <Label className="text-xs text-muted-foreground">Points at</Label>
          <Select value={newVariant} onValueChange={setNewVariant}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="concept">Concept (default)</SelectItem>
              {variants.map(v => (
                <SelectItem key={v.id} value={v.id}>
                  {v.modifier ?? '(default variant)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" disabled={!newText.trim() || creating} onClick={add}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>

      {langs.length === 0 ? (
        <div className="text-sm text-muted-foreground py-4">No aliases yet.</div>
      ) : (
        <div className="space-y-3">
          {langs.map(lang => (
            <div key={lang}>
              <div className="text-xs font-semibold text-muted-foreground mb-1.5">
                {lang.toUpperCase()} ({grouped[lang].length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {grouped[lang].map(a => (
                  <span
                    key={a.id}
                    className="inline-flex items-center gap-1 rounded bg-muted px-2 py-1 text-xs"
                  >
                    <code>{a.alias_text}</code>
                    {a.variant_id && (
                      <span className="text-muted-foreground">→ {variantLabel(a.variant_id)}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => void remove(a)}
                      className="ml-1 text-muted-foreground hover:text-destructive"
                      aria-label={`Delete ${a.alias_text}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
