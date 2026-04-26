'use client';

import { useMemo, useState } from 'react';
import {
  PRIMARY_PROTEINS,
  DISH_KIND_META,
  countryToLanguage,
  SUPPORTED_LANGUAGES,
  isSupportedLanguage,
  DEFAULT_LANGUAGE,
  type SupportedLanguage,
} from '@eatme/shared';
import type { RestaurantCategoryOption, CanonicalCategoryOption } from '@/lib/auth/dal';
import { adminConfirmMenuScan } from '../actions/menuScan';

type DishKind = keyof typeof DISH_KIND_META;
type Protein = (typeof PRIMARY_PROTEINS)[number];

export type ExtractedDish = {
  name: string;
  description: string | null;
  price: number | null;
  dish_kind: DishKind;
  primary_protein: Protein;
  suggested_category_name: string | null;
  canonical_category_slug: string | null;
  source_image_index: number;
  confidence: number;
};

type CategoryMode = 'none' | 'existing' | 'canonical' | 'custom';

type EditableDish = ExtractedDish & {
  _id: string;
  _deleted: boolean;
  categoryMode: CategoryMode;
  categoryExistingId: string | null;
  categoryCanonicalSlug: string | null;
  categoryCustomName: string;
};

interface Props {
  jobId: string;
  initialDishes: ExtractedDish[];
  countryCode: string | null;
  detectedLanguage: string | null;
  existingCategories: RestaurantCategoryOption[];
  canonicalCategories: CanonicalCategoryOption[];
}

const DISH_KIND_VALUES = Object.keys(DISH_KIND_META) as DishKind[];

function pickName(dict: Record<string, string>, lang: SupportedLanguage, fallback: string): string {
  return dict[lang] ?? dict[DEFAULT_LANGUAGE] ?? fallback;
}

function asEditable(d: ExtractedDish, i: number, canonicalSlugSet: Set<string>): EditableDish {
  // Initial category resolution from AI hints:
  //   canonical match (validated against our seed) → 'canonical'
  //   else suggested_category_name (verbatim source text) → 'custom'
  //   else 'none'
  let categoryMode: CategoryMode = 'none';
  let categoryCanonicalSlug: string | null = null;
  let categoryCustomName = '';

  if (d.canonical_category_slug && canonicalSlugSet.has(d.canonical_category_slug)) {
    categoryMode = 'canonical';
    categoryCanonicalSlug = d.canonical_category_slug;
  } else if (d.suggested_category_name && d.suggested_category_name.trim()) {
    categoryMode = 'custom';
    categoryCustomName = d.suggested_category_name.trim();
  }

  return {
    ...d,
    _id: `dish-${i}`,
    _deleted: false,
    categoryMode,
    categoryExistingId: null,
    categoryCanonicalSlug,
    categoryCustomName,
  };
}

function confidenceTone(c: number): string {
  if (c >= 0.85) return 'bg-green-100 text-green-800 border-green-200';
  if (c >= 0.6) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  return 'bg-red-100 text-red-800 border-red-200';
}

// Encode the category state into a single <select> value.
function encodeCategoryValue(d: EditableDish): string {
  switch (d.categoryMode) {
    case 'existing':
      return d.categoryExistingId ? `existing:${d.categoryExistingId}` : '';
    case 'canonical':
      return d.categoryCanonicalSlug ? `canonical:${d.categoryCanonicalSlug}` : '';
    case 'custom':
      return 'custom';
    case 'none':
    default:
      return '';
  }
}

function decodeCategoryValue(value: string): Partial<EditableDish> {
  if (value === '') {
    return {
      categoryMode: 'none',
      categoryExistingId: null,
      categoryCanonicalSlug: null,
    };
  }
  if (value === 'custom') {
    return {
      categoryMode: 'custom',
      categoryExistingId: null,
      categoryCanonicalSlug: null,
    };
  }
  if (value.startsWith('existing:')) {
    return {
      categoryMode: 'existing',
      categoryExistingId: value.slice('existing:'.length),
      categoryCanonicalSlug: null,
    };
  }
  if (value.startsWith('canonical:')) {
    return {
      categoryMode: 'canonical',
      categoryExistingId: null,
      categoryCanonicalSlug: value.slice('canonical:'.length),
    };
  }
  return {};
}

export function ReviewDishEditor({
  jobId,
  initialDishes,
  countryCode,
  detectedLanguage,
  existingCategories,
  canonicalCategories,
}: Props) {
  const canonicalSlugSet = useMemo(
    () => new Set(canonicalCategories.map(c => c.slug)),
    [canonicalCategories]
  );

  const countryDerivedLang = useMemo(() => countryToLanguage(countryCode), [countryCode]);

  const [sourceLanguage, setSourceLanguage] = useState<SupportedLanguage>(countryDerivedLang);

  const [dishes, setDishes] = useState<EditableDish[]>(() =>
    initialDishes.map((d, i) => asEditable(d, i, canonicalSlugSet))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeDishes = useMemo(() => dishes.filter(d => !d._deleted), [dishes]);
  const deletedCount = dishes.length - activeDishes.length;

  // Language mismatch warning: only meaningful if AI detected a language AND
  // it differs from country-derived AND the user hasn't already switched.
  const detectedDiffers =
    !!detectedLanguage &&
    detectedLanguage !== sourceLanguage &&
    detectedLanguage !== countryDerivedLang;

  const update = (id: string, patch: Partial<EditableDish>) => {
    setDishes(prev => prev.map(d => (d._id === id ? { ...d, ...patch } : d)));
  };

  const toggleDelete = (id: string) => {
    setDishes(prev => prev.map(d => (d._id === id ? { ...d, _deleted: !d._deleted } : d)));
  };

  const handleSave = async () => {
    setError(null);
    if (activeDishes.length === 0) {
      setError('Nothing to save — all dishes are removed.');
      return;
    }
    const invalidName = activeDishes.find(d => !d.name.trim());
    if (invalidName) {
      setError('Every dish needs a name.');
      return;
    }
    const invalidCustom = activeDishes.find(
      d => d.categoryMode === 'custom' && !d.categoryCustomName.trim()
    );
    if (invalidCustom) {
      setError('Custom category names cannot be empty. Pick a category or remove the dish.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        source_language_code: sourceLanguage,
        dishes: activeDishes.map(d => ({
          name: d.name.trim(),
          description: d.description?.trim() || null,
          price: d.price,
          dish_kind: d.dish_kind,
          primary_protein: d.primary_protein,
          source_image_index: d.source_image_index,
          category_existing_id: d.categoryMode === 'existing' ? d.categoryExistingId : null,
          category_canonical_slug: d.categoryMode === 'canonical' ? d.categoryCanonicalSlug : null,
          category_custom_name: d.categoryMode === 'custom' ? d.categoryCustomName.trim() : null,
        })),
      };
      const result = await adminConfirmMenuScan(jobId, payload);
      if (!result.ok) {
        setError(result.formError ?? 'Save failed');
        return;
      }
      // Realtime subscription in AdminJobShell will flip status → 'completed'.
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header + save action */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Extracted Dishes</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {activeDishes.length} to import
            {deletedCount > 0 && ` · ${deletedCount} removed`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || activeDishes.length === 0}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {saving
            ? 'Saving…'
            : `Save ${activeDishes.length} dish${activeDishes.length === 1 ? '' : 'es'}`}
        </button>
      </div>

      {/* Source language selector + mismatch banner */}
      <div className="rounded border border-border bg-muted/20 p-3 space-y-2">
        <div className="flex items-center gap-3 flex-wrap">
          <label htmlFor="source-language" className="text-xs font-medium">
            Menu source language
          </label>
          <select
            id="source-language"
            value={sourceLanguage}
            onChange={e => {
              if (isSupportedLanguage(e.target.value)) {
                setSourceLanguage(e.target.value);
              }
            }}
            disabled={saving}
            className="rounded border border-border bg-background px-2 py-1 text-xs"
          >
            {SUPPORTED_LANGUAGES.map(lang => (
              <option key={lang} value={lang}>
                {lang} {lang === countryDerivedLang ? '(country default)' : ''}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground">
            Used for any custom categories created from this scan.
          </span>
        </div>

        {detectedDiffers && (
          <p className="text-xs rounded bg-yellow-50 dark:bg-yellow-900/20 text-yellow-900 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-900/40 p-2">
            ⚠ AI detected the menu in <strong>{detectedLanguage}</strong>, but the
            restaurant&rsquo;s country defaults to <strong>{countryDerivedLang}</strong>.
            {isSupportedLanguage(detectedLanguage) && (
              <>
                {' '}
                <button
                  type="button"
                  onClick={() => setSourceLanguage(detectedLanguage)}
                  className="underline font-medium ml-1"
                >
                  Switch to {detectedLanguage}
                </button>
              </>
            )}
          </p>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded p-3"
        >
          {error}
        </p>
      )}

      {/* Dish list */}
      <ul className="space-y-3">
        {dishes.map(d => (
          <li
            key={d._id}
            className={[
              'rounded-lg border p-4 space-y-3 transition-opacity',
              d._deleted ? 'border-dashed border-border opacity-50' : 'border-border bg-card',
            ].join(' ')}
          >
            {/* Name + badges + remove */}
            <div className="flex items-start gap-2">
              <input
                aria-label="Dish name"
                value={d.name}
                onChange={e => update(d._id, { name: e.target.value })}
                disabled={d._deleted || saving}
                placeholder="Dish name"
                className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm font-medium disabled:opacity-50"
              />
              <span
                className={`shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${confidenceTone(d.confidence)}`}
                title="AI extraction confidence"
              >
                {(d.confidence * 100).toFixed(0)}%
              </span>
              <span
                className="shrink-0 inline-flex items-center rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                title="Source image index"
              >
                pg {d.source_image_index + 1}
              </span>
              <button
                type="button"
                onClick={() => toggleDelete(d._id)}
                disabled={saving}
                className="shrink-0 rounded border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
              >
                {d._deleted ? 'Restore' : 'Remove'}
              </button>
            </div>

            <textarea
              aria-label="Description"
              value={d.description ?? ''}
              onChange={e => update(d._id, { description: e.target.value || null })}
              disabled={d._deleted || saving}
              placeholder="Description (optional)"
              rows={2}
              className="w-full rounded border border-border bg-background px-3 py-2 text-sm disabled:opacity-50 resize-y"
            />

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-muted-foreground">Price</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={d.price ?? ''}
                  onChange={e =>
                    update(d._id, {
                      price: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                  disabled={d._deleted || saving}
                  placeholder="—"
                  className="rounded border border-border bg-background px-2 py-1.5 text-sm disabled:opacity-50"
                />
              </label>

              <label className="flex flex-col gap-1 text-xs">
                <span className="text-muted-foreground">Kind</span>
                <select
                  value={d.dish_kind}
                  onChange={e => update(d._id, { dish_kind: e.target.value as DishKind })}
                  disabled={d._deleted || saving}
                  className="rounded border border-border bg-background px-2 py-1.5 text-sm disabled:opacity-50"
                >
                  {DISH_KIND_VALUES.map(k => (
                    <option key={k} value={k}>
                      {DISH_KIND_META[k].icon} {DISH_KIND_META[k].label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-xs">
                <span className="text-muted-foreground">Primary protein</span>
                <select
                  value={d.primary_protein}
                  onChange={e => update(d._id, { primary_protein: e.target.value as Protein })}
                  disabled={d._deleted || saving}
                  className="rounded border border-border bg-background px-2 py-1.5 text-sm disabled:opacity-50"
                >
                  {PRIMARY_PROTEINS.map(p => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Category resolution */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium">Menu category</span>
                {d.suggested_category_name && (
                  <span
                    className="text-[10px] text-muted-foreground italic"
                    title="Verbatim section text from the menu image"
                  >
                    AI saw: &ldquo;{d.suggested_category_name}&rdquo;
                  </span>
                )}
              </div>
              <select
                value={encodeCategoryValue(d)}
                onChange={e => update(d._id, decodeCategoryValue(e.target.value))}
                disabled={d._deleted || saving}
                className="rounded border border-border bg-background px-2 py-1.5 text-sm disabled:opacity-50"
              >
                <option value="">— No category —</option>

                {existingCategories.length > 0 && (
                  <optgroup label="Existing for this restaurant">
                    {existingCategories.map(c => (
                      <option key={c.id} value={`existing:${c.id}`}>
                        {pickName(c.name_translations, sourceLanguage, c.name)}
                      </option>
                    ))}
                  </optgroup>
                )}

                <optgroup label="Canonical taxonomy">
                  {canonicalCategories.map(c => (
                    <option key={c.slug} value={`canonical:${c.slug}`}>
                      {pickName(c.names, sourceLanguage, c.slug)}
                    </option>
                  ))}
                </optgroup>

                <option value="custom">+ Custom name…</option>
              </select>

              {d.categoryMode === 'custom' && (
                <input
                  aria-label="Custom category name"
                  value={d.categoryCustomName}
                  onChange={e => update(d._id, { categoryCustomName: e.target.value })}
                  disabled={d._deleted || saving}
                  placeholder={`Type a custom category name (in ${sourceLanguage})`}
                  className="mt-1 rounded border border-border bg-background px-2 py-1.5 text-sm disabled:opacity-50"
                />
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
