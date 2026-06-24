'use client';

import { useMemo, useState } from 'react';
import {
  PRIMARY_PROTEINS,
  DINING_FORMATS,
  DINING_FORMAT_META,
  countryToLanguage,
  SUPPORTED_LANGUAGES,
  isSupportedLanguage,
  getCurrencyInfo,
  isSupportedCurrency,
  type DiningFormat,
  type SupportedLanguage,
} from '@eatme/shared';
import type {
  RestaurantCategoryOption,
  CanonicalCategoryOption,
  DishCategoryOption,
  DishCategoryMatch,
} from '@/lib/auth/dal';
import { adminConfirmMenuScan } from '../../actions/menuScan';
import { isSuspiciouslyHighPrice, priceWarnMessage } from '@/lib/priceWarnings';
import { DishCategoryCombobox } from '@/components/DishCategoryCombobox';
import { MenuCategoryCombobox, type MenuCategoryOption } from '@/components/MenuCategoryCombobox';
import { DishCategoryCreateInline } from '@/components/DishCategoryCreateInline';
import {
  useReviewState,
  type CategoryPatch,
  type EditableDish,
  type ExtractedDish,
  type PricePrefix,
  type Protein,
} from '../useReviewState';
import { ModifierGroupsEditor } from '@/components/modifiers/ModifierGroupsEditor';
import { ScanExtrasPanel } from '../ScanExtrasPanel';
import {
  pickName,
  asEditable,
  confidenceTone,
  getGroupKey,
  encodeCategoryValue,
  decodeCategoryValue,
} from './reviewHelpers';
import { buildConfirmPayload } from './buildConfirmPayload';
import { BundledItemsBlock } from './BundledItemsBlock';

export type { ExtractedDish } from '../useReviewState';

interface Props {
  jobId: string;
  initialDishes: ExtractedDish[];
  countryCode: string | null;
  // ISO 4217 from the parent restaurant. Used to render the currency symbol
  // next to each dish-price input + the label so admin knows which currency
  // the AI extracted into.
  currencyCode: string;
  detectedLanguage: string | null;
  existingCategories: RestaurantCategoryOption[];
  canonicalCategories: CanonicalCategoryOption[];
  dishCategories: DishCategoryOption[];
  dishCategoryMatches: DishCategoryMatch[];
  // Called with a dish's source_image_index when the operator focuses it, so the
  // parent can sync the side-by-side source-image preview panel.
  onActiveImageIndexChange?: (index: number) => void;
}

export function ReviewDishEditor({
  jobId,
  initialDishes,
  countryCode,
  currencyCode,
  detectedLanguage,
  existingCategories,
  canonicalCategories,
  dishCategories: initialDishCategories,
  dishCategoryMatches,
  onActiveImageIndexChange,
}: Props) {
  const currencySymbol = isSupportedCurrency(currencyCode)
    ? getCurrencyInfo(currencyCode).symbol
    : '$';
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
    copyModifierGroups,
    mergeCategory,
    attachScannedExtras,
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

  // Bulk-copy selection (operator issue #13). Holds dish _ids; deleted dishes
  // are filtered out at use-time so removing a selected dish can't make it a
  // silent copy target.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectedActiveIds = useMemo(
    () => activeDishes.filter(d => selectedIds.has(d._id)).map(d => d._id),
    [activeDishes, selectedIds]
  );

  const toggleSelected = (id: string) =>
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Select-all toggle for one category section: if every active dish in the
  // section is already selected, deselect them; otherwise select them all.
  const toggleGroupSelection = (groupDishes: EditableDish[]) => {
    const ids = groupDishes.filter(d => !d._deleted).map(d => d._id);
    if (ids.length === 0) return;
    const allSelected = ids.every(id => selectedIds.has(id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      for (const id of ids) {
        if (allSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  };

  const handleCopyGroups = (sourceDishId: string) => {
    copyModifierGroups(sourceDishId, selectedActiveIds);
    setSelectedIds(new Set());
  };

  // Category merge (over-split categories). Build the target group's category
  // fields from a representative dish in it (all dishes in a group share these;
  // prefer a non-deleted one)…
  const groupCategoryPatch = (targetKey: string): CategoryPatch | null => {
    const rep =
      activeDishes.find(d => getGroupKey(d) === targetKey) ??
      dishes.find(d => getGroupKey(d) === targetKey);
    if (!rep) return null;
    return {
      categoryMode: rep.categoryMode,
      categoryExistingId: rep.categoryExistingId,
      categoryCanonicalSlug: rep.categoryCanonicalSlug,
      categoryCustomName: rep.categoryCustomName,
    };
  };

  // …then reassign every active dish in the source section to it in one action.
  const handleMergeGroup = (sourceKey: string, targetKey: string) => {
    if (!targetKey || targetKey === sourceKey) return;
    const patch = groupCategoryPatch(targetKey);
    if (!patch) return;
    const ids = activeDishes.filter(d => getGroupKey(d) === sourceKey).map(d => d._id);
    if (ids.length === 0) return;
    mergeCategory(ids, patch);
  };

  // Supplementary scan-from-image panel (operator issue #12). Two entry
  // points: the selection bar (bulk — targets the selected dishes, live) and a
  // per-dish "Scan from image" button in the modifier-groups header (targets
  // just that dish, no selection needed; panel renders inside its card).
  const [scanTarget, setScanTarget] = useState<
    { kind: 'selection' } | { kind: 'dish'; dishId: string } | null
  >(null);

  const handleScannedExtrasAttach = (
    targetIds: string[],
    scannedGroups: Parameters<typeof attachScannedExtras>[1],
    scannedItems: Parameters<typeof attachScannedExtras>[2]
  ) => {
    attachScannedExtras(targetIds, scannedGroups, scannedItems);
    setScanTarget(null);
  };

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
      const payload = buildConfirmPayload({
        activeDishes,
        sourceLanguage,
        categoryDescriptions,
        getGroupKey,
        getGroupMeta,
      });
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

      {selectedActiveIds.length > 0 && (
        <div className="sticky top-2 z-10 flex items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 shadow-sm dark:border-amber-800 dark:bg-amber-950">
          <p className="text-xs text-amber-900 dark:text-amber-200">
            <strong>{selectedActiveIds.length}</strong> dish
            {selectedActiveIds.length === 1 ? '' : 'es'} selected — use &ldquo;Copy modifier
            groups&rdquo; on the dish that has the groups you want to spread.
          </p>
          <div className="flex shrink-0 gap-2">
            {scanTarget === null && (
              <button
                type="button"
                onClick={() => setScanTarget({ kind: 'selection' })}
                disabled={saving}
                className="rounded border border-amber-300 bg-background px-2 py-1 text-xs hover:bg-amber-100 disabled:opacity-50 dark:border-amber-800 dark:hover:bg-amber-900/40"
              >
                Scan modifiers from image…
              </button>
            )}
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="rounded border border-amber-300 bg-background px-2 py-1 text-xs hover:bg-amber-100 dark:border-amber-800 dark:hover:bg-amber-900/40"
            >
              Clear selection
            </button>
          </div>
        </div>
      )}

      {scanTarget?.kind === 'selection' && (
        <ScanExtrasPanel
          currencyCode={currencyCode}
          targetCount={selectedActiveIds.length}
          targetLabel={`${selectedActiveIds.length} selected dish${selectedActiveIds.length === 1 ? '' : 'es'}`}
          saving={saving}
          onAttach={(scannedGroups, scannedItems) => {
            handleScannedExtrasAttach(selectedActiveIds, scannedGroups, scannedItems);
            setSelectedIds(new Set());
          }}
          onClose={() => setScanTarget(null)}
        />
      )}

      {groups.map(group => {
        const meta = getGroupMeta(group.key);
        const desc = categoryDescriptions.get(group.key) ?? '';
        // Other real sections this one can be merged into (collapses an
        // over-split category). Excludes self and the uncategorized bucket.
        const mergeTargets = groups.filter(
          g => g.key !== group.key && g.key !== 'none' && g.dishes.some(d => !d._deleted)
        );
        const hasActiveDishes = group.dishes.some(d => !d._deleted);
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
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {group.dishes.filter(d => !d._deleted).length} dish
                    {group.dishes.filter(d => !d._deleted).length === 1 ? '' : 'es'}
                  </span>
                  {hasActiveDishes && mergeTargets.length > 0 && (
                    <select
                      aria-label={`Merge ${meta.displayName} into another section`}
                      title="Move every dish in this section into another section"
                      value=""
                      onChange={e => handleMergeGroup(group.key, e.target.value)}
                      disabled={saving}
                      className="rounded border border-border bg-background px-2 py-0.5 text-[11px] hover:bg-muted disabled:opacity-50"
                    >
                      <option value="" disabled>
                        Merge into…
                      </option>
                      {mergeTargets.map(g => {
                        // Append the source badge (Canonical/Existing/Custom) so
                        // two sections that share a display name (e.g. a canonical
                        // "Appetizers" and a custom "Appetizers") stay distinguishable.
                        const m = getGroupMeta(g.key);
                        return (
                          <option key={g.key} value={g.key}>
                            {m.badge ? `${m.displayName} · ${m.badge}` : m.displayName}
                          </option>
                        );
                      })}
                    </select>
                  )}
                  <button
                    type="button"
                    onClick={() => toggleGroupSelection(group.dishes)}
                    disabled={saving || group.dishes.every(d => d._deleted)}
                    className="rounded border border-border px-2 py-0.5 text-[11px] hover:bg-muted disabled:opacity-50"
                  >
                    {group.dishes.filter(d => !d._deleted).every(d => selectedIds.has(d._id)) &&
                    group.dishes.some(d => !d._deleted)
                      ? 'Deselect all'
                      : 'Select all'}
                  </button>
                </div>
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
                  onFocusCapture={() => onActiveImageIndexChange?.(d.source_image_index)}
                  onMouseDown={() => onActiveImageIndexChange?.(d.source_image_index)}
                  className={[
                    'rounded border p-3 space-y-2 transition-opacity',
                    d._deleted ? 'border-dashed border-border opacity-50' : 'border-border bg-card',
                  ].join(' ')}
                >
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      aria-label={`Select ${d.name.trim() || 'dish'} for bulk copy`}
                      checked={selectedIds.has(d._id)}
                      onChange={() => toggleSelected(d._id)}
                      disabled={d._deleted || saving}
                      title="Select as a target for bulk modifier-group copy"
                      className="mt-3 h-4 w-4 shrink-0 disabled:opacity-50"
                    />
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
                      <span className="text-muted-foreground">Price ({currencyCode})</span>
                      <div
                        className={`flex items-stretch rounded border bg-background overflow-hidden ${
                          isSuspiciouslyHighPrice(d.price, currencyCode)
                            ? 'border-amber-500'
                            : 'border-border'
                        }`}
                      >
                        <span className="px-1.5 flex items-center text-xs text-muted-foreground bg-muted/40 border-r border-border">
                          {currencySymbol}
                        </span>
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
                          aria-label={`Price (${currencyCode})`}
                          className="flex-1 min-w-0 bg-transparent px-2 py-1.5 text-sm focus:outline-none disabled:opacity-50"
                        />
                      </div>
                      {isSuspiciouslyHighPrice(d.price, currencyCode) && (
                        <span className="text-[10px] text-amber-700 dark:text-amber-400">
                          ⚠ {priceWarnMessage(currencyCode)}
                        </span>
                      )}
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
                    <>
                      <ModifierGroupsEditor
                        groups={d.modifier_groups}
                        saving={saving}
                        currencyCode={currencyCode}
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
                        onScanFromImage={() => setScanTarget({ kind: 'dish', dishId: d._id })}
                      />
                      {scanTarget?.kind === 'dish' && scanTarget.dishId === d._id && (
                        <ScanExtrasPanel
                          currencyCode={currencyCode}
                          targetCount={1}
                          targetLabel={`“${d.name.trim() || 'this dish'}”`}
                          saving={saving}
                          onAttach={(scannedGroups, scannedItems) =>
                            handleScannedExtrasAttach([d._id], scannedGroups, scannedItems)
                          }
                          onClose={() => setScanTarget(null)}
                        />
                      )}
                      {d.modifier_groups.length > 0 &&
                        selectedActiveIds.some(id => id !== d._id) && (
                          <button
                            type="button"
                            onClick={() => handleCopyGroups(d._id)}
                            disabled={saving}
                            className="w-full rounded border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200 dark:hover:bg-amber-900/40"
                          >
                            ⧉ Copy {d.modifier_groups.length} modifier group
                            {d.modifier_groups.length === 1 ? '' : 's'} from this dish to{' '}
                            {selectedActiveIds.filter(id => id !== d._id).length} selected dish
                            {selectedActiveIds.filter(id => id !== d._id).length === 1 ? '' : 'es'}
                          </button>
                        )}
                    </>
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
