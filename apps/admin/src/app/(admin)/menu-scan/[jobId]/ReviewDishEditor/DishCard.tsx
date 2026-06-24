'use client';

import {
  PRIMARY_PROTEINS,
  DINING_FORMATS,
  DINING_FORMAT_META,
  type DiningFormat,
} from '@eatme/shared';
import type { DishCategoryOption } from '@/lib/auth/dal';
import { isSuspiciouslyHighPrice, priceWarnMessage } from '@/lib/priceWarnings';
import { DishCategoryCombobox } from '@/components/DishCategoryCombobox';
import { MenuCategoryCombobox, type MenuCategoryOption } from '@/components/MenuCategoryCombobox';
import { DishCategoryCreateInline } from '@/components/DishCategoryCreateInline';
import { ModifierGroupsEditor } from '@/components/modifiers/ModifierGroupsEditor';
import { ScanExtrasPanel } from '../ScanExtrasPanel';
import { BundledItemsBlock } from './BundledItemsBlock';
import { encodeCategoryValue, decodeCategoryValue, confidenceTone } from './reviewHelpers';
import {
  type EditableDish,
  type EditableModifierGroup,
  type EditableModifierOption,
  type ExtractedBundledItem,
  type ExtractedModifierGroup,
  type PricePrefix,
  type Protein,
} from '../useReviewState';

interface DishCardProps {
  dish: EditableDish;
  saving: boolean;
  currencyCode: string;
  currencySymbol: string;
  sourceLanguage: string;
  menuCategoryOptions: MenuCategoryOption[];
  dishCategories: DishCategoryOption[];
  dishCategoryById: Map<string, DishCategoryOption>;
  selected: boolean;
  selectedActiveIds: string[];
  scanTargetForThisDish: boolean;
  // Fires the dish's source_image_index upward (onFocusCapture + onMouseDown on
  // the <li>) so the parent-owned SourceImageStrip in AdminJobShell can sync.
  onActiveImageIndexChange?: (index: number) => void;
  onUpdate: (patch: Partial<EditableDish>) => void;
  onToggleDelete: () => void;
  onToggleSelected: () => void;
  onScanFromImage: () => void;
  onScannedExtrasAttach: (groups: ExtractedModifierGroup[], items: ExtractedBundledItem[]) => void;
  onScanClose: () => void;
  onCopyGroups: () => void;
  onDishCategoryCreated: (cat: DishCategoryOption) => void;
  // Modifier-group handlers threaded straight to ModifierGroupsEditor.
  onAddGroup: () => void;
  onRemoveGroup: (groupIdx: number) => void;
  onMoveGroup: (from: number, to: number) => void;
  onUpdateGroup: (groupIdx: number, patch: Partial<EditableModifierGroup>) => void;
  onAddOption: (groupIdx: number) => void;
  onRemoveOption: (groupIdx: number, optIdx: number) => void;
  onMoveOption: (groupIdx: number, from: number, to: number) => void;
  onUpdateOption: (
    groupIdx: number,
    optIdx: number,
    patch: Partial<EditableModifierOption>
  ) => void;
  // Bundled-item handlers threaded straight to BundledItemsBlock.
  onAddBundledItem: () => void;
  onRemoveBundledItem: (itemIdx: number) => void;
  onUpdateBundledItem: (
    itemIdx: number,
    patch: Partial<{ name: string; note: string | null }>
  ) => void;
}

export function DishCard(props: DishCardProps) {
  const {
    dish,
    saving,
    currencyCode,
    currencySymbol,
    sourceLanguage,
    menuCategoryOptions,
    dishCategories,
    dishCategoryById,
    selected,
    selectedActiveIds,
    scanTargetForThisDish,
    onActiveImageIndexChange,
    onUpdate,
    onToggleDelete,
    onToggleSelected,
    onScanFromImage,
    onScannedExtrasAttach,
    onScanClose,
    onCopyGroups,
    onDishCategoryCreated,
    onAddGroup,
    onRemoveGroup,
    onMoveGroup,
    onUpdateGroup,
    onAddOption,
    onRemoveOption,
    onMoveOption,
    onUpdateOption,
    onAddBundledItem,
    onRemoveBundledItem,
    onUpdateBundledItem,
  } = props;
  // Alias so the moved <li> JSX stays byte-identical (every `d.` below).
  const d = dish;
  return (
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
          checked={selected}
          onChange={() => onToggleSelected()}
          disabled={d._deleted || saving}
          title="Select as a target for bulk modifier-group copy"
          className="mt-3 h-4 w-4 shrink-0 disabled:opacity-50"
        />
        <input
          aria-label="Dish name"
          value={d.name}
          onChange={e => onUpdate({ name: e.target.value })}
          disabled={d._deleted || saving}
          placeholder="Dish name"
          className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm font-medium disabled:opacity-50"
        />
        {d.dining_format && (
          <span
            className="shrink-0 inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-800 dark:border-violet-900/40 dark:bg-violet-900/20 dark:text-violet-200"
            title={DINING_FORMAT_META[d.dining_format].description}
          >
            {DINING_FORMAT_META[d.dining_format].icon} {DINING_FORMAT_META[d.dining_format].label}
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
          onClick={() => onToggleDelete()}
          disabled={saving}
          className="shrink-0 rounded border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
        >
          {d._deleted ? 'Restore' : 'Remove'}
        </button>
      </div>

      <textarea
        aria-label="Dish description"
        value={d.description ?? ''}
        onChange={e => onUpdate({ description: e.target.value || null })}
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
              isSuspiciouslyHighPrice(d.price, currencyCode) ? 'border-amber-500' : 'border-border'
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
                onUpdate({
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
                onUpdate({
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
                onUpdate({
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
              onUpdate({
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
            onChange={e => onUpdate({ primary_protein: e.target.value as Protein })}
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
              onUpdate({
                dining_format: e.target.value === '' ? null : (e.target.value as DiningFormat),
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
          onChange={v => onUpdate(decodeCategoryValue(v))}
          disabled={d._deleted || saving}
          ariaLabel="Menu category"
        />

        {d.categoryMode === 'custom' && (
          <input
            aria-label="Custom category name"
            value={d.categoryCustomName}
            onChange={e => onUpdate({ categoryCustomName: e.target.value })}
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
              onUpdate({
                dishCategoryId: id,
                dishCategoryUnmatched: false,
              })
            }
          />
          <DishCategoryCreateInline
            initialName={d.suggested_dish_category ?? ''}
            disabled={d._deleted || saving}
            onCreated={cat => onDishCategoryCreated(cat)}
          />
        </div>
        {d.dishCategoryUnmatched && (
          <p className="text-[11px] text-yellow-800 dark:text-yellow-400">
            ⚠ AI suggested &ldquo;{d.suggested_dish_category}&rdquo; but no close match was found.
            Pick from the dropdown or create a new one.
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
        onAdd={() => onAddBundledItem()}
        onRemove={idx => onRemoveBundledItem(idx)}
        onUpdate={(idx, patch) => onUpdateBundledItem(idx, patch)}
      />

      {/* Modifier groups (replaces variants + courses) */}
      {!d._deleted && (
        <>
          <ModifierGroupsEditor
            groups={d.modifier_groups}
            saving={saving}
            currencyCode={currencyCode}
            onAddGroup={() => onAddGroup()}
            onRemoveGroup={idx => onRemoveGroup(idx)}
            onMoveGroup={(from, to) => onMoveGroup(from, to)}
            onUpdateGroup={(idx, patch) => onUpdateGroup(idx, patch)}
            onAddOption={idx => onAddOption(idx)}
            onRemoveOption={(gIdx, oIdx) => onRemoveOption(gIdx, oIdx)}
            onMoveOption={(gIdx, from, to) => onMoveOption(gIdx, from, to)}
            onUpdateOption={(gIdx, oIdx, patch) => onUpdateOption(gIdx, oIdx, patch)}
            onScanFromImage={() => onScanFromImage()}
          />
          {scanTargetForThisDish && (
            <ScanExtrasPanel
              currencyCode={currencyCode}
              targetCount={1}
              targetLabel={`“${d.name.trim() || 'this dish'}”`}
              saving={saving}
              onAttach={(scannedGroups, scannedItems) =>
                onScannedExtrasAttach(scannedGroups, scannedItems)
              }
              onClose={() => onScanClose()}
            />
          )}
          {d.modifier_groups.length > 0 && selectedActiveIds.some(id => id !== d._id) && (
            <button
              type="button"
              onClick={() => onCopyGroups()}
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
  );
}
