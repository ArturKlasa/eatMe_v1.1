'use client';

import { useMemo, useState } from 'react';
import {
  PRIMARY_PROTEINS,
  DINING_FORMATS,
  DINING_FORMAT_META,
  countryToLanguage,
  SUPPORTED_LANGUAGES,
  isSupportedLanguage,
  DEFAULT_LANGUAGE,
  type DiningFormat,
  type SupportedLanguage,
} from '@eatme/shared';
import type {
  RestaurantCategoryOption,
  CanonicalCategoryOption,
  DishCategoryOption,
  DishCategoryMatch,
} from '@/lib/auth/dal';
import { adminConfirmMenuScan } from '../actions/menuScan';
import { DishCategoryCombobox } from '@/components/DishCategoryCombobox';
import { MenuCategoryCombobox, type MenuCategoryOption } from '@/components/MenuCategoryCombobox';
import { DishCategoryCreateInline } from '@/components/DishCategoryCreateInline';
import {
  useReviewState,
  type CategoryMode,
  type EditableDish,
  type ExtractedDish,
  type PricePrefix,
  type Protein,
} from './useReviewState';
import { ModifierGroupsEditor } from '@/components/modifiers/ModifierGroupsEditor';

export type { ExtractedDish } from './useReviewState';

interface Props {
  jobId: string;
  initialDishes: ExtractedDish[];
  countryCode: string | null;
  detectedLanguage: string | null;
  existingCategories: RestaurantCategoryOption[];
  canonicalCategories: CanonicalCategoryOption[];
  dishCategories: DishCategoryOption[];
  dishCategoryMatches: DishCategoryMatch[];
}

function pickName(dict: Record<string, string>, lang: SupportedLanguage, fallback: string): string {
  return dict[lang] ?? dict[DEFAULT_LANGUAGE] ?? fallback;
}

// Map legacy worker output to the new dining_format hint. Only fires when the
// worker did NOT provide a dining_format directly (i.e. very old jobs scanned
// before Phase 2 shipped the dining_format field).
function deriveDiningFormat(d: ExtractedDish): DiningFormat | null {
  if (d.dining_format !== undefined) return d.dining_format;
  if (d.dish_kind === 'course_menu') return 'course_menu';
  if (d.dish_kind === 'buffet') return 'buffet';
  return null;
}

function asEditable(
  d: ExtractedDish,
  i: number,
  canonicalSlugSet: Set<string>,
  matchByQuery: Map<string, DishCategoryMatch>
): EditableDish {
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

  let dishCategoryId: string | null = null;
  let dishCategoryUnmatched = false;
  const sdc = d.suggested_dish_category?.trim();
  if (sdc) {
    const match = matchByQuery.get(sdc);
    if (match?.matched_id) {
      dishCategoryId = match.matched_id;
    } else {
      dishCategoryUnmatched = true;
    }
  }

  const modifierGroups = (d.modifier_groups ?? []).map((g, gi) => ({
    _id: `mg-${i}-${gi}`,
    name: g.name,
    selection_type: g.selection_type,
    min_selections: g.min_selections,
    max_selections: g.max_selections,
    display_in_card: g.display_in_card,
    options: g.options.map((o, oi) => ({
      _id: `mo-${i}-${gi}-${oi}`,
      name: o.name,
      price_delta: o.price_delta,
      price_override: o.price_override,
      primary_protein: o.primary_protein,
      removes_dietary_tags: o.removes_dietary_tags,
      adds_allergens: o.adds_allergens,
      serves_delta: o.serves_delta,
      is_default: o.is_default,
    })),
  }));

  const bundledItems = (d.bundled_items ?? []).map((b, bi) => ({
    _id: `bi-${i}-${bi}`,
    name: b.name,
    note: b.note,
  }));

  return {
    name: d.name,
    description: d.description,
    price: d.price,
    primary_protein: d.primary_protein,
    suggested_category_name: d.suggested_category_name,
    canonical_category_slug: d.canonical_category_slug,
    suggested_category_description: d.suggested_category_description,
    suggested_dish_category: d.suggested_dish_category,
    source_image_index: d.source_image_index,
    confidence: d.confidence,
    _id: `dish-${i}`,
    _deleted: false,
    categoryMode,
    categoryExistingId: null,
    categoryCanonicalSlug,
    categoryCustomName,
    dishCategoryId,
    dishCategoryUnmatched,
    display_price_prefix: d.display_price_prefix ?? 'exact',
    serves: d.serves ?? null,
    dining_format: deriveDiningFormat(d),
    bundled_items: bundledItems,
    modifier_groups: modifierGroups,
    // Portion fields coerced from optional-undefined on the wire to required-null
    // on the editable side so the paired form control has stable state.
    portion_amount: d.portion_amount ?? null,
    portion_unit: d.portion_unit ?? null,
  };
}

function confidenceTone(c: number): string {
  if (c >= 0.85) return 'bg-green-100 text-green-800 border-green-200';
  if (c >= 0.6) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  return 'bg-red-100 text-red-800 border-red-200';
}

function getGroupKey(d: EditableDish): string {
  switch (d.categoryMode) {
    case 'existing':
      return d.categoryExistingId ? `e:${d.categoryExistingId}` : 'none';
    case 'canonical':
      return d.categoryCanonicalSlug ? `c:${d.categoryCanonicalSlug}` : 'none';
    case 'custom': {
      const trimmed = d.categoryCustomName.trim();
      return trimmed ? `n:${trimmed.toLowerCase()}` : 'none';
    }
    case 'none':
    default:
      return 'none';
  }
}

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
    return { categoryMode: 'none', categoryExistingId: null, categoryCanonicalSlug: null };
  }
  if (value === 'custom') {
    return { categoryMode: 'custom', categoryExistingId: null, categoryCanonicalSlug: null };
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
  dishCategories: initialDishCategories,
  dishCategoryMatches,
}: Props) {
  const canonicalSlugSet = useMemo(
    () => new Set(canonicalCategories.map(c => c.slug)),
    [canonicalCategories]
  );
  const canonicalBySlug = useMemo(
    () => new Map(canonicalCategories.map(c => [c.slug, c])),
    [canonicalCategories]
  );
  const existingById = useMemo(
    () => new Map(existingCategories.map(c => [c.id, c])),
    [existingCategories]
  );

  const matchByQuery = useMemo(
    () => new Map(dishCategoryMatches.map(m => [m.query, m])),
    [dishCategoryMatches]
  );

  const [dishCategories, setDishCategories] = useState<DishCategoryOption[]>(initialDishCategories);
  const dishCategoryById = useMemo(
    () => new Map(dishCategories.map(c => [c.id, c])),
    [dishCategories]
  );

  const countryDerivedLang = useMemo(() => countryToLanguage(countryCode), [countryCode]);
  const [sourceLanguage, setSourceLanguage] = useState<SupportedLanguage>(countryDerivedLang);

  const menuCategoryOptions: MenuCategoryOption[] = useMemo(() => {
    const opts: MenuCategoryOption[] = [
      { value: '', label: '— No category —' },
      { value: 'custom', label: '+ Custom name…' },
    ];
    for (const c of existingCategories) {
      opts.push({
        value: `existing:${c.id}`,
        label: pickName(c.name_translations, sourceLanguage, c.name),
        group: 'Existing for this restaurant',
      });
    }
    for (const c of canonicalCategories) {
      opts.push({
        value: `canonical:${c.slug}`,
        label: pickName(c.names, sourceLanguage, c.slug),
        group: 'Canonical taxonomy',
      });
    }
    return opts;
  }, [existingCategories, canonicalCategories, sourceLanguage]);

  const {
    dishes,
    update,
    toggleDelete,
    addModifierGroup,
    removeModifierGroup,
    moveModifierGroup,
    updateModifierGroup,
    addModifierOption,
    removeModifierOption,
    moveModifierOption,
    updateModifierOption,
    addBundledItem,
    removeBundledItem,
    updateBundledItem,
  } = useReviewState(
    useMemo(
      () => initialDishes.map((d, i) => asEditable(d, i, canonicalSlugSet, matchByQuery)),
      // initial only — recomputing on prop change would clobber edits
      // eslint-disable-next-line react-hooks/exhaustive-deps
      []
    )
  );

  const [categoryDescriptions, setCategoryDescriptions] = useState<Map<string, string>>(() => {
    const map = new Map<string, string>();
    const seen = new Set<string>();
    for (const d of dishes) {
      const key = getGroupKey(d);
      if (key === 'none' || seen.has(key)) continue;
      seen.add(key);
      if (key.startsWith('e:')) {
        const id = key.slice(2);
        const ex = existingById.get(id);
        if (ex?.description?.trim()) {
          map.set(key, ex.description);
          continue;
        }
      }
      if (d.suggested_category_description?.trim()) {
        map.set(key, d.suggested_category_description.trim());
      }
    }
    return map;
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeDishes = useMemo(() => dishes.filter(d => !d._deleted), [dishes]);
  const deletedCount = dishes.length - activeDishes.length;

  const detectedDiffers =
    !!detectedLanguage &&
    detectedLanguage !== sourceLanguage &&
    detectedLanguage !== countryDerivedLang;

  const groups = useMemo(() => {
    const order: string[] = [];
    const seen = new Set<string>();
    for (const d of dishes) {
      const key = getGroupKey(d);
      if (!seen.has(key)) {
        seen.add(key);
        order.push(key);
      }
    }
    const noneIdx = order.indexOf('none');
    if (noneIdx !== -1) {
      order.splice(noneIdx, 1);
      order.push('none');
    }
    return order.map(key => ({
      key,
      dishes: dishes.filter(d => getGroupKey(d) === key),
    }));
  }, [dishes]);

  function getGroupMeta(key: string): {
    displayName: string;
    descriptionLocked: boolean;
    badge: string | null;
  } {
    if (key === 'none') {
      return { displayName: '(no category)', descriptionLocked: true, badge: null };
    }
    if (key.startsWith('e:')) {
      const id = key.slice(2);
      const ex = existingById.get(id);
      const name = ex
        ? pickName(ex.name_translations, sourceLanguage, ex.name)
        : '(unknown existing)';
      const locked = !!ex?.description?.trim();
      return { displayName: name, descriptionLocked: locked, badge: 'Existing' };
    }
    if (key.startsWith('c:')) {
      const slug = key.slice(2);
      const canon = canonicalBySlug.get(slug);
      const name = canon ? pickName(canon.names, sourceLanguage, canon.slug) : slug;
      return { displayName: name, descriptionLocked: false, badge: 'Canonical' };
    }
    if (key.startsWith('n:')) {
      const firstDish = dishes.find(d => getGroupKey(d) === key);
      const name = firstDish?.categoryCustomName.trim() || key.slice(2);
      return { displayName: name, descriptionLocked: false, badge: 'Custom' };
    }
    return { displayName: key, descriptionLocked: false, badge: null };
  }

  const updateGroupDescription = (key: string, value: string) => {
    setCategoryDescriptions(prev => {
      const next = new Map(prev);
      if (value.trim() === '') next.delete(key);
      else next.set(key, value);
      return next;
    });
  };

  const handleDishCategoryCreated = (dishId: string, cat: DishCategoryOption) => {
    setDishCategories(prev => {
      const next = prev.some(c => c.id === cat.id) ? prev : [...prev, cat];
      return [...next].sort((a, b) => a.name.localeCompare(b.name));
    });
    update(dishId, { dishCategoryId: cat.id, dishCategoryUnmatched: false });
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
    const invalidGroup = activeDishes.find(d =>
      d.modifier_groups.some(g => !g.name.trim() || g.options.some(o => !o.name.trim()))
    );
    if (invalidGroup) {
      setError(
        'Every modifier group needs a name, and every option needs a name. Fix or remove the empty ones.'
      );
      return;
    }

    setSaving(true);
    try {
      // Build category_descriptions array — one entry per unique key referenced
      // by an active dish.
      const seenKeys = new Set<string>();
      const categoryDescriptionsPayload: Array<{
        canonical_slug: string | null;
        custom_name: string | null;
        existing_id: string | null;
        description: string | null;
        verbatim_name: string | null;
      }> = [];
      for (const d of activeDishes) {
        const key = getGroupKey(d);
        if (key === 'none' || seenKeys.has(key)) continue;
        seenKeys.add(key);

        const meta = getGroupMeta(key);
        const rawDesc = categoryDescriptions.get(key)?.trim() || null;
        const desc = rawDesc && !meta.descriptionLocked ? rawDesc : null;

        const verbatim =
          d.categoryMode === 'canonical' && d.suggested_category_name?.trim()
            ? d.suggested_category_name.trim()
            : null;

        if (!desc && !verbatim) continue;

        categoryDescriptionsPayload.push({
          canonical_slug: d.categoryMode === 'canonical' ? d.categoryCanonicalSlug : null,
          custom_name: d.categoryMode === 'custom' ? d.categoryCustomName.trim() : null,
          existing_id: d.categoryMode === 'existing' ? d.categoryExistingId : null,
          description: desc,
          verbatim_name: verbatim,
        });
      }

      const payload = {
        source_language_code: sourceLanguage,
        category_descriptions: categoryDescriptionsPayload,
        dishes: activeDishes.map(d => ({
          name: d.name.trim(),
          description: d.description?.trim() || null,
          price: d.price,
          primary_protein: d.primary_protein,
          source_image_index: d.source_image_index,
          category_existing_id: d.categoryMode === 'existing' ? d.categoryExistingId : null,
          category_canonical_slug: d.categoryMode === 'canonical' ? d.categoryCanonicalSlug : null,
          category_custom_name: d.categoryMode === 'custom' ? d.categoryCustomName.trim() : null,
          dish_category_id: d.dishCategoryId,
          display_price_prefix: d.display_price_prefix,
          serves: d.serves,
          dining_format: d.dining_format,
          portion_amount: d.portion_amount,
          portion_unit: d.portion_unit,
          bundled_items: d.bundled_items.map(b => ({
            name: b.name.trim(),
            note: b.note?.trim() || null,
          })),
          modifier_groups: d.modifier_groups.map(g => ({
            name: g.name.trim(),
            selection_type: g.selection_type,
            min_selections: g.min_selections,
            max_selections: g.max_selections,
            display_in_card: g.display_in_card,
            options: g.options.map(o => ({
              name: o.name.trim(),
              price_delta: o.price_delta,
              price_override: o.price_override,
              primary_protein: o.primary_protein,
              removes_dietary_tags: o.removes_dietary_tags,
              adds_allergens: o.adds_allergens,
              serves_delta: o.serves_delta,
              is_default: o.is_default,
            })),
          })),
        })),
      };
      const result = await adminConfirmMenuScan(jobId, payload);
      if (!result.ok) {
        setError(result.formError ?? 'Save failed');
        return;
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Extracted Dishes</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {activeDishes.length} to import · {groups.length} categor
            {groups.length === 1 ? 'y' : 'ies'}
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

      <div className="rounded border border-border bg-muted/20 p-3 space-y-2">
        <div className="flex items-center gap-3 flex-wrap">
          <label htmlFor="source-language" className="text-xs font-medium">
            Menu source language
          </label>
          <select
            id="source-language"
            value={sourceLanguage}
            onChange={e => {
              if (isSupportedLanguage(e.target.value)) setSourceLanguage(e.target.value);
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

      {groups.map(group => {
        const meta = getGroupMeta(group.key);
        const desc = categoryDescriptions.get(group.key) ?? '';
        return (
          <section key={group.key} className="rounded-lg border border-border bg-muted/10">
            <header className="border-b border-border px-4 py-3 space-y-2">
              <div className="flex items-baseline justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold">{meta.displayName}</h3>
                  {meta.badge && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium uppercase tracking-wide">
                      {meta.badge}
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {group.dishes.filter(d => !d._deleted).length} dish
                  {group.dishes.filter(d => !d._deleted).length === 1 ? '' : 'es'}
                </span>
              </div>
              {group.key !== 'none' &&
                (meta.descriptionLocked ? (
                  desc && (
                    <p className="text-xs text-muted-foreground italic">
                      {desc}{' '}
                      <span className="not-italic text-[10px]">
                        (existing description — edit on the restaurant page)
                      </span>
                    </p>
                  )
                ) : (
                  <textarea
                    aria-label={`${meta.displayName} description`}
                    value={desc}
                    onChange={e => updateGroupDescription(group.key, e.target.value)}
                    disabled={saving}
                    placeholder={`Section description (in ${sourceLanguage}, optional)`}
                    rows={2}
                    className="w-full rounded border border-border bg-background px-3 py-2 text-xs disabled:opacity-50 resize-y"
                  />
                ))}
            </header>

            <ul className="space-y-3 p-3">
              {group.dishes.map(d => (
                <li
                  key={d._id}
                  className={[
                    'rounded border p-3 space-y-2 transition-opacity',
                    d._deleted ? 'border-dashed border-border opacity-50' : 'border-border bg-card',
                  ].join(' ')}
                >
                  <div className="flex items-start gap-2">
                    <input
                      aria-label="Dish name"
                      value={d.name}
                      onChange={e => update(d._id, { name: e.target.value })}
                      disabled={d._deleted || saving}
                      placeholder="Dish name"
                      className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm font-medium disabled:opacity-50"
                    />
                    {d.dining_format && (
                      <span
                        className="shrink-0 inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-800 dark:border-violet-900/40 dark:bg-violet-900/20 dark:text-violet-200"
                        title={DINING_FORMAT_META[d.dining_format].description}
                      >
                        {DINING_FORMAT_META[d.dining_format].icon}{' '}
                        {DINING_FORMAT_META[d.dining_format].label}
                      </span>
                    )}
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
                    aria-label="Dish description"
                    value={d.description ?? ''}
                    onChange={e => update(d._id, { description: e.target.value || null })}
                    disabled={d._deleted || saving}
                    placeholder="Description (optional)"
                    rows={2}
                    className="w-full rounded border border-border bg-background px-3 py-2 text-sm disabled:opacity-50 resize-y"
                  />

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
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
                      <span
                        className="text-muted-foreground"
                        title="Portion size — extracted from menu text (e.g. 250g, 0.5L, 6 szt.). Both null or both set."
                      >
                        Portion
                      </span>
                      <div className="flex gap-1">
                        <input
                          type="number"
                          step="1"
                          min="1"
                          value={d.portion_amount ?? ''}
                          onChange={e => {
                            const v = e.target.value === '' ? null : Number(e.target.value);
                            update(d._id, {
                              portion_amount: v,
                              portion_unit: v === null ? null : (d.portion_unit ?? 'g'),
                            });
                          }}
                          disabled={d._deleted || saving}
                          placeholder="—"
                          aria-label="Portion amount"
                          className="flex-1 min-w-0 rounded border border-border bg-background px-2 py-1.5 text-sm disabled:opacity-50"
                        />
                        <select
                          value={d.portion_unit ?? ''}
                          disabled={d._deleted || saving || d.portion_amount == null}
                          onChange={e =>
                            update(d._id, {
                              portion_unit: e.target.value as 'g' | 'ml' | 'pcs' | 'oz',
                            })
                          }
                          aria-label="Portion unit"
                          className="rounded border border-border bg-background px-1 py-1.5 text-sm disabled:opacity-50"
                        >
                          <option value="" disabled>
                            —
                          </option>
                          <option value="g">g</option>
                          <option value="ml">ml</option>
                          <option value="pcs">pcs</option>
                          <option value="oz">oz</option>
                        </select>
                      </div>
                    </label>

                    <label className="flex flex-col gap-1 text-xs">
                      <span className="text-muted-foreground">Price label</span>
                      <select
                        value={d.display_price_prefix}
                        onChange={e =>
                          update(d._id, {
                            display_price_prefix: e.target.value as PricePrefix,
                          })
                        }
                        disabled={d._deleted || saving}
                        className="rounded border border-border bg-background px-2 py-1.5 text-sm disabled:opacity-50"
                      >
                        <option value="exact">Exact</option>
                        <option value="from">From</option>
                        <option value="per_person">Per person</option>
                        <option value="market_price">Market price</option>
                        <option value="ask_server">Ask server</option>
                      </select>
                    </label>

                    <label className="flex flex-col gap-1 text-xs">
                      <span className="text-muted-foreground">Primary protein</span>
                      <select
                        value={d.primary_protein}
                        onChange={e =>
                          update(d._id, { primary_protein: e.target.value as Protein })
                        }
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

                    <label className="flex flex-col gap-1 text-xs">
                      <span
                        className="text-muted-foreground"
                        title="Rarely set — only for buffets, course menus, hot pot, shared plates, samplers"
                      >
                        Dining format
                      </span>
                      <select
                        value={d.dining_format ?? ''}
                        onChange={e =>
                          update(d._id, {
                            dining_format:
                              e.target.value === '' ? null : (e.target.value as DiningFormat),
                          })
                        }
                        disabled={d._deleted || saving}
                        className="rounded border border-border bg-background px-2 py-1.5 text-sm disabled:opacity-50"
                      >
                        <option value="">— Standard —</option>
                        {DINING_FORMATS.map(f => (
                          <option key={f} value={f}>
                            {DINING_FORMAT_META[f].icon} {DINING_FORMAT_META[f].label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {/* Per-dish category override */}
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
                    <MenuCategoryCombobox
                      value={encodeCategoryValue(d)}
                      options={menuCategoryOptions}
                      onChange={v => update(d._id, decodeCategoryValue(v))}
                      disabled={d._deleted || saving}
                      ariaLabel="Menu category"
                    />

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

                  {/* Dish category (global filter taxonomy) */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground font-medium">
                        Dish category
                        <span
                          className="ml-1 text-[10px] text-muted-foreground italic font-normal"
                          title="Used by mobile recommendations + filters; not shown to consumers"
                        >
                          (filter taxonomy)
                        </span>
                      </span>
                      {d.suggested_dish_category && (
                        <span
                          className="text-[10px] text-muted-foreground italic"
                          title="Free-text classification from the AI"
                        >
                          AI suggested: &ldquo;{d.suggested_dish_category}&rdquo;
                        </span>
                      )}
                    </div>
                    <div className="flex items-start gap-2">
                      <DishCategoryCombobox
                        value={d.dishCategoryId ?? null}
                        options={dishCategories}
                        disabled={d._deleted || saving}
                        unmatched={d.dishCategoryUnmatched}
                        className="flex-1"
                        onChange={id =>
                          update(d._id, {
                            dishCategoryId: id,
                            dishCategoryUnmatched: false,
                          })
                        }
                      />
                      <DishCategoryCreateInline
                        initialName={d.suggested_dish_category ?? ''}
                        disabled={d._deleted || saving}
                        onCreated={cat => handleDishCategoryCreated(d._id, cat)}
                      />
                    </div>
                    {d.dishCategoryUnmatched && (
                      <p className="text-[11px] text-yellow-800 dark:text-yellow-400">
                        ⚠ AI suggested &ldquo;{d.suggested_dish_category}&rdquo; but no close match
                        was found. Pick from the dropdown or create a new one.
                      </p>
                    )}
                    {!d.dishCategoryUnmatched && d.dishCategoryId && (
                      <p className="text-[10px] text-muted-foreground">
                        Resolved to:{' '}
                        <span className="text-foreground">
                          {dishCategoryById.get(d.dishCategoryId)?.name ?? '(unknown)'}
                        </span>
                      </p>
                    )}
                  </div>

                  {/* Bundled items (e.g. "Lunch combo = Soup + Salad + Drink") */}
                  <BundledItemsBlock
                    dish={d}
                    saving={saving}
                    onAdd={() => addBundledItem(d._id)}
                    onRemove={idx => removeBundledItem(d._id, idx)}
                    onUpdate={(idx, patch) => updateBundledItem(d._id, idx, patch)}
                  />

                  {/* Modifier groups (replaces variants + courses) */}
                  {!d._deleted && (
                    <ModifierGroupsEditor
                      groups={d.modifier_groups}
                      saving={saving}
                      onAddGroup={() => addModifierGroup(d._id)}
                      onRemoveGroup={idx => removeModifierGroup(d._id, idx)}
                      onMoveGroup={(from, to) => moveModifierGroup(d._id, from, to)}
                      onUpdateGroup={(idx, patch) => updateModifierGroup(d._id, idx, patch)}
                      onAddOption={idx => addModifierOption(d._id, idx)}
                      onRemoveOption={(gIdx, oIdx) => removeModifierOption(d._id, gIdx, oIdx)}
                      onMoveOption={(gIdx, from, to) => moveModifierOption(d._id, gIdx, from, to)}
                      onUpdateOption={(gIdx, oIdx, patch) =>
                        updateModifierOption(d._id, gIdx, oIdx, patch)
                      }
                    />
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

interface BundledBlockProps {
  dish: EditableDish;
  saving: boolean;
  onAdd: () => void;
  onRemove: (itemIdx: number) => void;
  onUpdate: (itemIdx: number, patch: Partial<{ name: string; note: string | null }>) => void;
}

function BundledItemsBlock({ dish, saving, onAdd, onRemove, onUpdate }: BundledBlockProps) {
  if (dish._deleted) return null;
  const hasItems = dish.bundled_items.length > 0;
  return (
    <div className="rounded border border-dashed border-emerald-200 bg-emerald-50/40 p-2 space-y-1.5 dark:border-emerald-900/40 dark:bg-emerald-950/20">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-emerald-900 dark:text-emerald-200">
          Bundled items ({dish.bundled_items.length})
        </span>
        <button
          type="button"
          onClick={onAdd}
          disabled={saving}
          className="rounded border border-emerald-300 bg-background px-2 py-0.5 text-xs hover:bg-emerald-100 dark:border-emerald-800 dark:hover:bg-emerald-900/40 disabled:opacity-50"
        >
          + Add item
        </button>
      </div>
      {!hasItems ? (
        <p className="text-[11px] italic text-muted-foreground">
          Use for set menus / combos: list the included items (e.g. &ldquo;Soup of the day&rdquo;,
          &ldquo;Side salad&rdquo;, &ldquo;Drink&rdquo;).
        </p>
      ) : (
        <ul className="space-y-1">
          {dish.bundled_items.map((b, idx) => (
            <li key={b._id} className="flex items-center gap-1.5">
              <input
                aria-label="Bundled item name"
                value={b.name}
                onChange={e => onUpdate(idx, { name: e.target.value })}
                disabled={saving}
                placeholder="Item name"
                className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs disabled:opacity-50"
              />
              <input
                aria-label="Note"
                value={b.note ?? ''}
                onChange={e => onUpdate(idx, { note: e.target.value || null })}
                disabled={saving}
                placeholder="Note (optional)"
                className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => onRemove(idx)}
                disabled={saving}
                aria-label="Remove bundled item"
                className="rounded border border-border px-1.5 py-1 text-[11px] hover:bg-muted disabled:opacity-50"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
