'use client';

import { useMemo, useState } from 'react';
import {
  countryToLanguage,
  SUPPORTED_LANGUAGES,
  isSupportedLanguage,
  getCurrencyInfo,
  isSupportedCurrency,
  type SupportedLanguage,
} from '@eatme/shared';
import type {
  RestaurantCategoryOption,
  CanonicalCategoryOption,
  DishCategoryOption,
  DishCategoryMatch,
} from '@/lib/auth/dal';
import { adminConfirmMenuScan } from '../../actions/menuScan';
import { type MenuCategoryOption } from '@/components/MenuCategoryCombobox';
import {
  useReviewState,
  type CategoryPatch,
  type EditableDish,
  type ExtractedDish,
} from '../useReviewState';
import { ScanExtrasPanel } from '../ScanExtrasPanel';
import { pickName, asEditable, getGroupKey } from './reviewHelpers';
import { buildConfirmPayload } from './buildConfirmPayload';
import { CategorySection } from './CategorySection';
import { DishCard } from './DishCard';

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
    // LANDMINE L-1 — empty deps intentional; do NOT add initialDishes; see 10-CONTEXT.md
    useMemo(
      () => initialDishes.map((d, i) => asEditable(d, i, canonicalSlugSet, matchByQuery)),
      // initial only — recomputing on prop change would clobber edits
      // eslint-disable-next-line react-hooks/exhaustive-deps
      []
    )
  );

  // LANDMINE L-4 — lazy one-time seed; do NOT convert to initial-value + effect; see 10-CONTEXT.md
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
    // LANDMINE L-5 — 'none' bucket pushed last; preserves render order; do NOT reorder; see 10-CONTEXT.md
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
        const activeInGroup = group.dishes.filter(d => !d._deleted);
        const hasActiveDishes = activeInGroup.length > 0;
        const allSelected = hasActiveDishes && activeInGroup.every(d => selectedIds.has(d._id));
        // Other real sections this one can be merged into (collapses an
        // over-split category). Excludes self and the uncategorized bucket.
        // Append the source badge (Canonical/Existing/Custom) so two sections
        // that share a display name (e.g. a canonical "Appetizers" and a custom
        // "Appetizers") stay distinguishable. getGroupMeta is impure (closes
        // over the lookup maps) so we resolve the labels here, not in the child.
        const mergeTargets = groups
          .filter(g => g.key !== group.key && g.key !== 'none' && g.dishes.some(d => !d._deleted))
          .map(g => {
            const m = getGroupMeta(g.key);
            return { key: g.key, label: m.badge ? `${m.displayName} · ${m.badge}` : m.displayName };
          });
        return (
          <CategorySection
            key={group.key}
            meta={meta}
            groupKey={group.key}
            dishCount={activeInGroup.length}
            mergeTargets={mergeTargets}
            hasActiveDishes={hasActiveDishes}
            allSelected={allSelected}
            saving={saving}
            sourceLanguage={sourceLanguage}
            description={desc}
            onMergeGroup={v => handleMergeGroup(group.key, v)}
            onToggleGroupSelection={() => toggleGroupSelection(group.dishes)}
            onUpdateGroupDescription={v => updateGroupDescription(group.key, v)}
          >
            <ul className="space-y-3 p-3">
              {group.dishes.map(d => (
                <DishCard
                  key={d._id}
                  dish={d}
                  saving={saving}
                  currencyCode={currencyCode}
                  currencySymbol={currencySymbol}
                  sourceLanguage={sourceLanguage}
                  menuCategoryOptions={menuCategoryOptions}
                  dishCategories={dishCategories}
                  dishCategoryById={dishCategoryById}
                  selected={selectedIds.has(d._id)}
                  selectedActiveIds={selectedActiveIds}
                  scanTargetForThisDish={scanTarget?.kind === 'dish' && scanTarget.dishId === d._id}
                  onActiveImageIndexChange={onActiveImageIndexChange}
                  onUpdate={patch => update(d._id, patch)}
                  onToggleDelete={() => toggleDelete(d._id)}
                  onToggleSelected={() => toggleSelected(d._id)}
                  onScanFromImage={() => setScanTarget({ kind: 'dish', dishId: d._id })}
                  onScannedExtrasAttach={(scannedGroups, scannedItems) =>
                    handleScannedExtrasAttach([d._id], scannedGroups, scannedItems)
                  }
                  onScanClose={() => setScanTarget(null)}
                  onCopyGroups={() => handleCopyGroups(d._id)}
                  onDishCategoryCreated={cat => handleDishCategoryCreated(d._id, cat)}
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
                  onAddBundledItem={() => addBundledItem(d._id)}
                  onRemoveBundledItem={idx => removeBundledItem(d._id, idx)}
                  onUpdateBundledItem={(idx, patch) => updateBundledItem(d._id, idx, patch)}
                />
              ))}
            </ul>
          </CategorySection>
        );
      })}
    </div>
  );
}
