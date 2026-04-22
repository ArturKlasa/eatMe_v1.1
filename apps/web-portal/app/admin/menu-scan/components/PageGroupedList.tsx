'use client';

import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ImageIcon,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { type EditableDish, type EditableMenu, countDishes } from '@/lib/menu-scan';
import { DISH_KIND_META } from '@eatme/shared';
import { DishGroupCard } from '@/components/admin/menu-scan/DishGroupCard';
import { BatchToolbar } from '@/components/admin/menu-scan/BatchToolbar';
import { FlaggedDuplicateCard } from '@/components/admin/menu-scan/FlaggedDuplicateCard';
import { DishEditPanelV2 } from './DishEditPanelV2';
import { useReviewStore } from '../store';
import { selectDishesByImageIndex } from '../store/selectors';

const NEW_KIND_SET = new Set(Object.keys(DISH_KIND_META));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color =
    confidence >= 0.85
      ? 'bg-success/10 text-success'
      : confidence >= 0.6
        ? 'bg-warning/10 text-warning'
        : 'bg-destructive/10 text-destructive';
  return <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', color)}>{pct}%</span>;
}

/** Build dishId → {mIdx, cIdx, dIdx} lookup map for index-based store actions. */
function buildDishIndexMap(
  menus: EditableMenu[]
): Map<string, { mIdx: number; cIdx: number; dIdx: number }> {
  const map = new Map<string, { mIdx: number; cIdx: number; dIdx: number }>();
  menus.forEach((menu, mIdx) =>
    menu.categories.forEach((cat, cIdx) =>
      cat.dishes.forEach((dish, dIdx) => map.set(dish._id, { mIdx, cIdx, dIdx }))
    )
  );
  return map;
}

// ---------------------------------------------------------------------------
// PageGroupHeader
// ---------------------------------------------------------------------------

interface PageGroupHeaderProps {
  pageIdx: number;
  dishCount: number;
  previewUrl: string | undefined;
  onJump: () => void;
}

function PageGroupHeader({ pageIdx, dishCount, previewUrl, onJump }: PageGroupHeaderProps) {
  return (
    <div
      data-testid="page-group-header"
      className="sticky top-0 z-10 flex items-center gap-2 px-3 py-2 bg-background/95 backdrop-blur-sm border-b"
    >
      {previewUrl ? (
        <img
          src={previewUrl}
          alt={`Page ${pageIdx + 1}`}
          className="w-8 h-8 rounded object-cover shrink-0 cursor-pointer opacity-80 hover:opacity-100 transition-opacity"
          onClick={onJump}
        />
      ) : (
        <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
          <ImageIcon className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <span className="font-semibold text-sm text-foreground">Page {pageIdx + 1}</span>
      <span className="text-xs text-muted-foreground">
        {dishCount} dish{dishCount !== 1 ? 'es' : ''}
      </span>
      <button
        type="button"
        onClick={onJump}
        className="ml-auto text-xs text-muted-foreground hover:text-brand-primary transition-colors"
      >
        View ↗
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DishRow — single collapsible dish card with page chip
// ---------------------------------------------------------------------------

interface DishRowProps {
  dish: EditableDish;
  pageIdx: number;
  mIdx: number;
  cIdx: number;
  dIdx: number;
  currency: string;
  isExpanded: boolean;
  onJump: () => void;
}

function DishRow({ dish, pageIdx, mIdx, cIdx, dIdx, currency, isExpanded, onJump }: DishRowProps) {
  const updateDish = useReviewStore(s => s.updateDish);
  const deleteDish = useReviewStore(s => s.deleteDish);
  const toggleExpand = useReviewStore(s => s.toggleExpand);
  const hasUnmatched = dish.ingredients.some(i => i.status === 'unmatched');

  return (
    <div
      className={cn(
        'rounded-lg border p-3 transition-colors',
        dish.confidence < 0.6
          ? 'border-destructive/20 bg-destructive/10'
          : dish.confidence < 0.85
            ? 'border-yellow-200 bg-yellow-50/20'
            : 'border'
      )}
    >
      {/* Collapsed row */}
      <div className="flex items-center gap-2">
        {/* Page chip — jumps the left carousel to this source image */}
        <button
          type="button"
          data-testid="page-chip"
          onClick={onJump}
          className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium shrink-0 hover:bg-primary/20 transition-colors"
        >
          P{pageIdx + 1}
        </button>

        <input
          value={dish.name}
          onChange={e => updateDish(mIdx, cIdx, dIdx, { name: e.target.value })}
          className="flex-1 font-medium text-sm bg-transparent border-0 border-b border-transparent focus:border-brand-primary/70 focus:outline-none min-w-0"
          placeholder="Dish name"
        />

        <div className="flex items-center gap-1 shrink-0">
          <span className="text-xs text-muted-foreground">{currency}</span>
          <input
            type="number"
            value={dish.price}
            onChange={e => updateDish(mIdx, cIdx, dIdx, { price: e.target.value })}
            className="w-20 text-sm text-right border border-input rounded px-2 py-0.5 focus:outline-none focus:border-brand-primary/70"
            placeholder="0.00"
            step="0.01"
            min="0"
          />
        </div>

        <ConfidenceBadge confidence={dish.confidence} />

        {hasUnmatched && (
          <AlertTriangle
            className="h-4 w-4 text-brand-primary shrink-0"
            aria-label="Unmatched ingredients"
          />
        )}

        <button
          onClick={() => toggleExpand(dish._id)}
          className="p-1 text-muted-foreground hover:text-foreground"
        >
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        <button
          onClick={() => deleteDish(mIdx, cIdx, dIdx)}
          className="p-1 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Expanded detail */}
      {isExpanded && <DishEditPanelV2 dish={dish} mIdx={mIdx} cIdx={cIdx} dIdx={dIdx} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PageGroupedList
// ---------------------------------------------------------------------------

export function PageGroupedList() {
  const currency = useReviewStore(s => s.currency);
  const editableMenus = useReviewStore(s => s.editableMenus);
  const previewUrls = useReviewStore(s => s.previewUrls);
  const expandedDishes = useReviewStore(s => s.expandedDishes);
  const isSuggestingAll = useReviewStore(s => s.isSuggestingAll);
  const suggestAllProgress = useReviewStore(s => s.suggestAllProgress);
  const saving = useReviewStore(s => s.saving);
  const flaggedDuplicates = useReviewStore(s => s.flaggedDuplicates);
  const selectedGroupIds = useReviewStore(s => s.selectedGroupIds);
  const setSelectedGroupIds = useReviewStore(s => s.setSelectedGroupIds);
  const batchFilters = useReviewStore(s => s.batchFilters);
  const setBatchFilters = useReviewStore(s => s.setBatchFilters);
  const setFocusedGroupId = useReviewStore(s => s.setFocusedGroupId);
  const handleSave = useReviewStore(s => s.handleSave);
  const setStep = useReviewStore(s => s.setStep);
  const setCurrentImageIdx = useReviewStore(s => s.setCurrentImageIdx);
  const suggestAllDishes = useReviewStore(s => s.suggestAllDishes);
  const addVariantDish = useReviewStore(s => s.addVariantDish);
  const addMenu = useReviewStore(s => s.addMenu);
  const toggleExpand = useReviewStore(s => s.toggleExpand);
  const updateDishById = useReviewStore(s => s.updateDishById);
  const acceptGroup = useReviewStore(s => s.acceptGroup);
  const rejectGroup = useReviewStore(s => s.rejectGroup);
  const ungroupChild = useReviewStore(s => s.ungroupChild);
  const groupFlaggedDuplicate = useReviewStore(s => s.groupFlaggedDuplicate);
  const dismissFlaggedDuplicate = useReviewStore(s => s.dismissFlaggedDuplicate);
  const acceptHighConfidence = useReviewStore(s => s.acceptHighConfidence);
  const acceptSelected = useReviewStore(s => s.acceptSelected);
  const rejectSelected = useReviewStore(s => s.rejectSelected);

  const groups = selectDishesByImageIndex({ editableMenus });
  const indexMap = buildDishIndexMap(editableMenus);

  const reviewedGroupCount = editableMenus.reduce(
    (total, menu) =>
      total +
      menu.categories.reduce(
        (sum, cat) =>
          sum +
          cat.dishes.filter(
            d => d.is_parent && (d.group_status === 'accepted' || d.group_status === 'rejected')
          ).length,
        0
      ),
    0
  );

  const totalGroupCount = editableMenus.reduce(
    (total, menu) =>
      total +
      menu.categories.reduce((sum, cat) => sum + cat.dishes.filter(d => d.is_parent).length, 0),
    0
  );

  const totalDishes = countDishes(editableMenus);

  return (
    <div className="flex-1 overflow-y-auto space-y-4 pr-1">
      {/* Suggest All toolbar */}
      {editableMenus.length > 0 && (
        <div className="flex items-center justify-between bg-background rounded-xl border px-4 py-2.5">
          <p className="text-xs text-muted-foreground">
            {suggestAllProgress
              ? `Analysing… ${suggestAllProgress.done} / ${suggestAllProgress.total} dishes`
              : `${countDishes(editableMenus)} dishes extracted`}
          </p>
          <button
            type="button"
            disabled={isSuggestingAll}
            onClick={suggestAllDishes}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100 disabled:opacity-50 transition-colors font-medium"
          >
            {isSuggestingAll ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Suggest All
          </button>
        </div>
      )}

      {/* BatchToolbar for group review */}
      {totalGroupCount > 0 && (
        <BatchToolbar
          totalGroups={totalGroupCount}
          reviewedCount={reviewedGroupCount}
          selectedIds={selectedGroupIds}
          onAcceptAll={() => acceptHighConfidence(0)}
          onAcceptHighConfidence={acceptHighConfidence}
          onAcceptSelected={acceptSelected}
          onRejectSelected={rejectSelected}
          filters={batchFilters}
          onFiltersChange={setBatchFilters}
        />
      )}

      {/* Flagged duplicates from multi-page merge */}
      {flaggedDuplicates.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-amber-700 px-1">
            {flaggedDuplicates.length} potential variant
            {flaggedDuplicates.length !== 1 ? 's' : ''} detected
          </h3>
          {flaggedDuplicates.map((dup, i) => (
            <FlaggedDuplicateCard
              key={i}
              duplicate={dup}
              onGroupTogether={() => groupFlaggedDuplicate(i)}
              onKeepSeparate={() => dismissFlaggedDuplicate(i)}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {editableMenus.length === 0 && (
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground space-y-3">
          <AlertTriangle className="h-10 w-10" />
          <p className="font-medium">No dishes extracted</p>
          <p className="text-sm">Try re-scanning with a clearer image.</p>
          <Button variant="outline" onClick={() => setStep('upload')}>
            ← Re-scan
          </Button>
        </div>
      )}

      {/* Page-grouped dish cards */}
      {Array.from(groups.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([pageIdx, pageDishes]) => {
          const topLevel = pageDishes.filter((d: EditableDish) => !d.parent_id);
          if (topLevel.length === 0) return null;

          return (
            <div key={pageIdx} className="bg-background rounded-xl border overflow-hidden">
              <PageGroupHeader
                pageIdx={pageIdx}
                dishCount={topLevel.length}
                previewUrl={previewUrls[pageIdx]}
                onJump={() => setCurrentImageIdx(pageIdx)}
              />

              <div className="p-2 space-y-2">
                {topLevel.map((dish: EditableDish) => {
                  const idxs = indexMap.get(dish._id);
                  if (!idxs) return null;
                  const { mIdx, cIdx, dIdx } = idxs;

                  // Legacy-kind parents use DishGroupCard (accept/reject group flow).
                  if (dish.is_parent && !NEW_KIND_SET.has(dish.dish_kind)) {
                    const catDishes = editableMenus[mIdx]?.categories[cIdx]?.dishes ?? [];
                    const children = catDishes.filter(
                      (d: EditableDish) => d.parent_id === dish._id
                    );
                    return (
                      <div
                        key={dish._id}
                        onFocus={e => {
                          if (
                            !(e.target as HTMLElement).closest(
                              'select, input, button, textarea, label'
                            )
                          ) {
                            setFocusedGroupId(dish._id);
                          }
                        }}
                        onClick={e => {
                          if (
                            !(e.target as HTMLElement).closest(
                              'select, input, button, textarea, label'
                            )
                          ) {
                            setFocusedGroupId(dish._id);
                          }
                        }}
                      >
                        <DishGroupCard
                          parent={dish}
                          // eslint-disable-next-line react/no-children-prop
                          children={children}
                          onAccept={() => acceptGroup(dish._id)}
                          onReject={() => rejectGroup(dish._id)}
                          onEdit={() => toggleExpand(dish._id)}
                          onUngroup={ungroupChild}
                          onUpdateDish={updateDishById}
                          onAddVariant={() => addVariantDish(mIdx, cIdx, dish._id)}
                          currency={currency}
                          isSelected={selectedGroupIds.has(dish._id)}
                          onToggleSelect={() =>
                            setSelectedGroupIds(prev => {
                              const next = new Set(prev);
                              if (next.has(dish._id)) next.delete(dish._id);
                              else next.add(dish._id);
                              return next;
                            })
                          }
                        />
                      </div>
                    );
                  }

                  // New-kind dishes use collapsible card + DishEditPanelV2.
                  return (
                    <DishRow
                      key={dish._id}
                      dish={dish}
                      pageIdx={pageIdx}
                      mIdx={mIdx}
                      cIdx={cIdx}
                      dIdx={dIdx}
                      currency={currency}
                      isExpanded={expandedDishes.has(dish._id)}
                      onJump={() => setCurrentImageIdx(pageIdx)}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}

      {/* Add menu section button */}
      <button
        onClick={addMenu}
        className="w-full text-sm text-muted-foreground hover:text-foreground border border-dashed border-input rounded-xl py-3 hover:border-input hover:bg-accent transition-colors flex items-center justify-center gap-1"
      >
        <Plus className="h-4 w-4" /> Add Menu Section
      </button>

      {/* Bottom save bar */}
      <div className="sticky bottom-0 pb-2">
        <div className="bg-background border rounded-xl p-4 flex items-center justify-between shadow-lg">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{totalDishes} dishes</span> ready to
            save
          </p>
          <Button
            onClick={() => handleSave()}
            disabled={saving || totalDishes === 0}
            className="bg-brand-primary hover:bg-brand-primary/90 text-background"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving…
              </>
            ) : (
              <>Save & Commit to Database</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
