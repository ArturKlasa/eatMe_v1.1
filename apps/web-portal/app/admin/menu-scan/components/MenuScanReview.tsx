'use client';

import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Trash2,
  Plus,
  Loader2,
  AlertTriangle,
  X,
  Utensils,
  Store,
  ZoomIn,
  MapPin,
  Sparkles,
  Layers,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { getDietaryTagIcon, getAllergenIcon } from '@/lib/icons';
import { AddIngredientPanel } from '@/components/admin/AddIngredientPanel';
import { InlineIngredientSearch } from '@/components/admin/InlineIngredientSearch';
import { type EditableDish, type EditableMenu, countDishes } from '@/lib/menu-scan';
import { createDishCategory } from '@/lib/dish-categories';
import { DishGroupCard } from '@/components/admin/menu-scan/DishGroupCard';
import { BatchToolbar } from '@/components/admin/menu-scan/BatchToolbar';
import { FlaggedDuplicateCard } from '@/components/admin/menu-scan/FlaggedDuplicateCard';
import dynamic from 'next/dynamic';
import type {
  RestaurantOption,
  RestaurantDetailsForm,
  AddIngredientTarget,
  DietaryTagOption,
} from '@/app/admin/menu-scan/hooks/useMenuScanState';
import type { EditableIngredient, FlaggedDuplicate } from '@/lib/menu-scan';
import type { DishCategory } from '@/lib/dish-categories';
import type { BatchFilters } from '@/components/admin/menu-scan/BatchToolbar';

const LocationPickerComponent = dynamic(() => import('@/components/LocationPicker'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-48 rounded-lg border bg-muted/50 flex items-center justify-center text-sm text-muted-foreground">
      Loading map…
    </div>
  ),
});

// ---------------------------------------------------------------------------
// Confidence badge (local helper)
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

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface MenuScanReviewProps {
  // From state
  selectedRestaurant: RestaurantOption | null;
  currency: string;
  imageFiles: File[];
  previewUrls: string[];
  editableMenus: EditableMenu[];
  setEditableMenus: (v: EditableMenu[] | ((prev: EditableMenu[]) => EditableMenu[])) => void;
  dishCategories: DishCategory[];
  setDishCategories: (v: DishCategory[] | ((prev: DishCategory[]) => DishCategory[])) => void;
  dietaryTags: DietaryTagOption[];
  currentImageIdx: number;
  setCurrentImageIdx: (v: number | ((prev: number) => number)) => void;
  expandedDishes: Set<string>;
  addIngredientTarget: AddIngredientTarget | null;
  setAddIngredientTarget: (v: AddIngredientTarget | null) => void;
  suggestingDishId: string | null;
  isSuggestingAll: boolean;
  suggestAllProgress: { done: number; total: number } | null;
  inlineSearchTarget: { mIdx: number; cIdx: number; dIdx: number } | null;
  setInlineSearchTarget: (v: { mIdx: number; cIdx: number; dIdx: number } | null) => void;
  subIngredientEditTarget: { mIdx: number; cIdx: number; dIdx: number; ingIdx: number } | null;
  setSubIngredientEditTarget: (v: { mIdx: number; cIdx: number; dIdx: number; ingIdx: number } | null) => void;
  saving: boolean;
  flaggedDuplicates: FlaggedDuplicate[];
  selectedGroupIds: Set<string>;
  setSelectedGroupIds: (v: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  batchFilters: BatchFilters;
  setBatchFilters: (v: BatchFilters) => void;
  focusedGroupId: string | null;
  setFocusedGroupId: (v: string | null) => void;
  restaurantDetails: RestaurantDetailsForm;
  updateRestaurantDetails: (patch: Partial<RestaurantDetailsForm>) => void;
  leftPanelTab: 'images' | 'details';
  setLeftPanelTab: (v: 'images' | 'details') => void;
  lightboxOpen: boolean;
  setLightboxOpen: (v: boolean) => void;
  reviewedGroupCount: number;
  totalGroupCount: number;

  // Step navigation
  setStep: (step: 'upload' | 'processing' | 'review' | 'done') => void;

  // Action handlers
  handleSave: () => Promise<void>;
  updateMenu: (mIdx: number, patch: Partial<EditableMenu>) => void;
  updateCategory: (mIdx: number, cIdx: number, patch: { name?: string }) => void;
  updateDish: (mIdx: number, cIdx: number, dIdx: number, patch: Partial<EditableDish>) => void;
  resolveIngredient: (mIdx: number, cIdx: number, dIdx: number, rawText: string, resolved: EditableIngredient) => void;
  addIngredientToDish: (mIdx: number, cIdx: number, dIdx: number, ing: EditableIngredient) => void;
  removeIngredientFromDish: (mIdx: number, cIdx: number, dIdx: number, ingIdx: number) => void;
  addSubIngredient: (mIdx: number, cIdx: number, dIdx: number, ingIdx: number, sub: EditableIngredient) => void;
  removeSubIngredient: (mIdx: number, cIdx: number, dIdx: number, ingIdx: number, subIdx: number) => void;
  suggestIngredients: (dishId: string, dishName: string, description: string, mIdx: number, cIdx: number, dIdx: number) => Promise<void>;
  suggestAllDishes: () => Promise<void>;
  deleteDish: (mIdx: number, cIdx: number, dIdx: number) => void;
  addDish: (mIdx: number, cIdx: number) => void;
  deleteCategory: (mIdx: number, cIdx: number) => void;
  addCategory: (mIdx: number) => void;
  deleteMenu: (mIdx: number) => void;
  addMenu: () => void;
  toggleExpand: (dishId: string) => void;
  updateDishById: (dishId: string, updates: Partial<EditableDish>) => void;
  acceptGroup: (parentId: string) => void;
  rejectGroup: (parentId: string) => void;
  ungroupChild: (childId: string) => void;
  groupFlaggedDuplicate: (dupIndex: number) => void;
  dismissFlaggedDuplicate: (dupIndex: number) => void;
  acceptHighConfidence: (threshold: number) => void;
  acceptSelected: () => void;
  rejectSelected: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MenuScanReview({
  selectedRestaurant,
  currency,
  imageFiles,
  previewUrls,
  editableMenus,
  setEditableMenus,
  dishCategories,
  setDishCategories,
  dietaryTags,
  currentImageIdx,
  setCurrentImageIdx,
  expandedDishes,
  addIngredientTarget,
  setAddIngredientTarget,
  suggestingDishId,
  isSuggestingAll,
  suggestAllProgress,
  inlineSearchTarget,
  setInlineSearchTarget,
  subIngredientEditTarget,
  setSubIngredientEditTarget,
  saving,
  flaggedDuplicates,
  selectedGroupIds,
  setSelectedGroupIds,
  batchFilters,
  setBatchFilters,
  focusedGroupId,
  setFocusedGroupId,
  restaurantDetails,
  updateRestaurantDetails,
  leftPanelTab,
  setLeftPanelTab,
  lightboxOpen,
  setLightboxOpen,
  reviewedGroupCount,
  totalGroupCount,
  setStep,
  handleSave,
  updateMenu,
  updateCategory,
  updateDish,
  resolveIngredient,
  addIngredientToDish,
  removeIngredientFromDish,
  addSubIngredient,
  removeSubIngredient,
  suggestIngredients,
  suggestAllDishes,
  deleteDish,
  addDish,
  deleteCategory,
  addCategory,
  deleteMenu,
  addMenu,
  toggleExpand,
  updateDishById,
  acceptGroup,
  rejectGroup,
  ungroupChild,
  groupFlaggedDuplicate,
  dismissFlaggedDuplicate,
  acceptHighConfidence,
  acceptSelected,
  rejectSelected,
}: MenuScanReviewProps) {
  const totalDishes = countDishes(editableMenus);

  return (
    <div className="flex flex-col h-[calc(100vh-140px)]">
      {/* Header bar */}
      <div className="flex items-center justify-between pb-4 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Utensils className="h-5 w-5 text-brand-primary" />
            Review: {selectedRestaurant?.name}
            <span className="text-sm font-normal text-muted-foreground ml-1">({currency})</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {totalDishes} dish{totalDishes !== 1 ? 'es' : ''} extracted — {imageFiles.length} image
            {imageFiles.length !== 1 ? 's' : ''}. Edit as needed, then save.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setStep('upload')} disabled={saving}>
            ← Re-scan
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || totalDishes === 0}
            className="bg-brand-primary hover:bg-brand-primary/90 text-background"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving…
              </>
            ) : (
              <>Save {totalDishes} dishes to DB</>
            )}
          </Button>
        </div>
      </div>

      {/* Two-panel body */}
      <div className="flex gap-5 min-h-0 flex-1">
        {/* ---- Left: Image carousel + Restaurant Details tabs ---- */}
        <div className="w-80 shrink-0 flex flex-col bg-background rounded-xl border overflow-hidden">
          {/* Tab switcher */}
          <div className="flex border-b shrink-0">
            <button
              onClick={() => setLeftPanelTab('images')}
              className={cn(
                'flex-1 py-2 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors',
                leftPanelTab === 'images'
                  ? 'text-brand-primary border-b-2 border-brand-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              🖼️ Images
            </button>
            <button
              onClick={() => setLeftPanelTab('details')}
              className={cn(
                'flex-1 py-2 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors',
                leftPanelTab === 'details'
                  ? 'text-brand-primary border-b-2 border-brand-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Store className="h-3 w-3" />
              Details
              {restaurantDetails.dirty && (
                <span className="w-1.5 h-1.5 rounded-full bg-brand-primary ml-0.5" />
              )}
            </button>
          </div>

          {/* IMAGES TAB */}
          {leftPanelTab === 'images' && (
            <>
              <div
                className="flex-1 overflow-hidden bg-muted/30 flex items-center justify-center relative min-h-0 cursor-zoom-in group"
                onClick={() => previewUrls.length > 0 && setLightboxOpen(true)}
              >
                {previewUrls.length > 0 ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrls[currentImageIdx]}
                      alt={`Page ${currentImageIdx + 1}`}
                      className="max-w-full max-h-full object-contain"
                    />
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        className="bg-black/50 text-white p-1.5 rounded-lg hover:bg-black/70"
                        title="Zoom in"
                      >
                        <ZoomIn className="h-4 w-4" />
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No preview</p>
                )}
              </div>
              {previewUrls.length > 1 ? (
                <div className="flex items-center justify-between p-3 border-t shrink-0">
                  <button
                    onClick={() => setCurrentImageIdx(i => Math.max(0, i - 1))}
                    disabled={currentImageIdx === 0}
                    className="p-1.5 rounded hover:bg-accent disabled:opacity-30"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-xs text-muted-foreground font-medium">
                    Page {currentImageIdx + 1} / {previewUrls.length}
                  </span>
                  <button
                    onClick={() => setCurrentImageIdx(i => Math.min(previewUrls.length - 1, i + 1))}
                    disabled={currentImageIdx === previewUrls.length - 1}
                    className="p-1.5 rounded hover:bg-accent disabled:opacity-30"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="p-2.5 border-t text-center shrink-0">
                  <button
                    onClick={() => setLightboxOpen(true)}
                    className="text-xs text-muted-foreground hover:text-brand-primary flex items-center gap-1 mx-auto"
                  >
                    <ZoomIn className="h-3 w-3" /> Click image to zoom
                  </button>
                </div>
              )}
            </>
          )}

          {/* DETAILS TAB */}
          {leftPanelTab === 'details' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Address</label>
                <Input
                  value={restaurantDetails.address}
                  onChange={e => updateRestaurantDetails({ address: e.target.value })}
                  placeholder="Street address"
                  className="text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">City</label>
                <Input
                  value={restaurantDetails.city}
                  onChange={e => updateRestaurantDetails({ city: e.target.value })}
                  placeholder="City"
                  className="text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Postal Code</label>
                <Input
                  value={restaurantDetails.postal_code}
                  onChange={e => updateRestaurantDetails({ postal_code: e.target.value })}
                  placeholder="e.g. 44100"
                  className="text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Neighbourhood</label>
                <Input
                  value={restaurantDetails.neighbourhood}
                  onChange={e => updateRestaurantDetails({ neighbourhood: e.target.value })}
                  placeholder="e.g. Zona Rosa"
                  className="text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Phone</label>
                <Input
                  value={restaurantDetails.phone}
                  onChange={e => updateRestaurantDetails({ phone: e.target.value })}
                  placeholder="+52 33 …"
                  type="tel"
                  className="text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Website</label>
                <Input
                  value={restaurantDetails.website}
                  onChange={e => updateRestaurantDetails({ website: e.target.value })}
                  placeholder="https://"
                  type="url"
                  className="text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Location
                  {restaurantDetails.lat && (
                    <span className="text-success text-[10px] ml-1">✓ pinned</span>
                  )}
                </label>
                <LocationPickerComponent
                  onLocationSelect={(lat, lng) => updateRestaurantDetails({ lat, lng })}
                  onAddressSelect={addr => {
                    updateRestaurantDetails({ address: addr });
                  }}
                  onLocationDetails={details => {
                    const patch: Partial<RestaurantDetailsForm> = {};
                    if (details.city) patch.city = details.city;
                    if (details.neighbourhood) patch.neighbourhood = details.neighbourhood;
                    if (details.state) patch.state = details.state;
                    if (details.postalCode) patch.postal_code = details.postalCode;
                    if (details.countryCode) patch.country_code = details.countryCode.toUpperCase();
                    updateRestaurantDetails(patch);
                    toast.success('Location details auto-filled!');
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* ---- Right: Extraction results ---- */}
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
                {flaggedDuplicates.length} potential variant{flaggedDuplicates.length !== 1 ? 's' : ''} detected
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

          {editableMenus.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground space-y-3">
              <AlertTriangle className="h-10 w-10" />
              <p className="font-medium">No dishes extracted</p>
              <p className="text-sm">Try re-scanning with a clearer image.</p>
              <Button variant="outline" onClick={() => setStep('upload')}>
                ← Re-scan
              </Button>
            </div>
          ) : (
            editableMenus.map((menu, mIdx) => (
              <div
                key={mIdx}
                className="bg-background rounded-xl border overflow-hidden"
              >
                {/* Menu header */}
                <div className="flex items-center gap-3 px-4 py-3 bg-muted/30 border-b">
                  <input
                    value={menu.name}
                    onChange={e => updateMenu(mIdx, { name: e.target.value })}
                    className="font-semibold text-foreground bg-transparent border-0 border-b border-dashed border-input focus:outline-none focus:border-brand-primary/70 min-w-0 flex-1"
                    placeholder="Menu name (e.g. Lunch)"
                  />
                  <select
                    value={menu.menu_type}
                    onChange={e =>
                      updateMenu(mIdx, { menu_type: e.target.value as 'food' | 'drink' })
                    }
                    className="text-xs border border-input rounded px-2 py-1 bg-background"
                  >
                    <option value="food">Food</option>
                    <option value="drink">Drink</option>
                  </select>
                  <button
                    onClick={() => addCategory(mIdx)}
                    className="text-xs text-brand-primary hover:underline flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" /> Category
                  </button>
                  <button
                    onClick={() => deleteMenu(mIdx)}
                    className="p-1 text-muted-foreground hover:text-destructive"
                    aria-label="Delete menu"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Categories */}
                <div className="divide-y">
                  {menu.categories.map((cat, cIdx) => (
                    <div key={cIdx} className="p-4">
                      {/* Category header */}
                      <div className="flex items-center gap-2 mb-3">
                        <input
                          value={cat.name}
                          onChange={e => updateCategory(mIdx, cIdx, { name: e.target.value })}
                          className="text-sm font-medium text-muted-foreground bg-transparent border-0 border-b border-dashed border-input focus:outline-none focus:border-brand-primary/70 flex-1 min-w-0"
                          placeholder="Category name (e.g. Appetizers)"
                        />
                        <button
                          onClick={() => addDish(mIdx, cIdx)}
                          className="text-xs text-brand-primary hover:underline flex items-center gap-1"
                        >
                          <Plus className="h-3 w-3" /> Dish
                        </button>
                        <button
                          onClick={() => deleteCategory(mIdx, cIdx)}
                          className="p-1 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Dishes */}
                      <div className="space-y-2">
                        {cat.dishes.map((dish, dIdx) => {
                          // Skip children — they render inside their parent's DishGroupCard
                          if (dish.parent_id) return null;

                          // Parent dishes render as DishGroupCard
                          if (dish.is_parent) {
                            const children = cat.dishes.filter(d => d.parent_id === dish._id);
                            return (
                              <div
                                key={dish._id}
                                onFocus={() => setFocusedGroupId(dish._id)}
                                onClick={() => setFocusedGroupId(dish._id)}
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

                          const isExpanded = expandedDishes.has(dish._id);
                          const hasUnmatched = dish.ingredients.some(i => i.status === 'unmatched');

                          return (
                            <div
                              key={dish._id}
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
                                <input
                                  value={dish.name}
                                  onChange={e =>
                                    updateDish(mIdx, cIdx, dIdx, { name: e.target.value })
                                  }
                                  className="flex-1 font-medium text-sm bg-transparent border-0 border-b border-transparent focus:border-brand-primary/70 focus:outline-none min-w-0"
                                  placeholder="Dish name"
                                />
                                <div className="flex items-center gap-1 shrink-0">
                                  <span className="text-xs text-muted-foreground">{currency}</span>
                                  <input
                                    type="number"
                                    value={dish.price}
                                    onChange={e =>
                                      updateDish(mIdx, cIdx, dIdx, { price: e.target.value })
                                    }
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
                                  {isExpanded ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </button>
                                <button
                                  onClick={() => deleteDish(mIdx, cIdx, dIdx)}
                                  className="p-1 text-muted-foreground hover:text-destructive"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>

                              {/* Expanded detail */}
                              {isExpanded && (
                                <div className="mt-3 space-y-3 pl-1">
                                  {/* Description */}
                                  <textarea
                                    value={dish.description}
                                    onChange={e =>
                                      updateDish(mIdx, cIdx, dIdx, { description: e.target.value })
                                    }
                                    rows={2}
                                    placeholder="Description (optional)"
                                    className="w-full text-sm border border-input rounded px-3 py-2 resize-none focus:outline-none focus:border-brand-primary/70"
                                  />

                                  {/* Dish kind, serves, display_price_prefix */}
                                  <div className="flex items-center gap-3 flex-wrap">
                                    <label className="flex items-center gap-1 text-xs text-muted-foreground">
                                      Kind:
                                      <select
                                        value={dish.dish_kind ?? 'standard'}
                                        onChange={e =>
                                          updateDish(mIdx, cIdx, dIdx, {
                                            dish_kind: e.target.value as EditableDish['dish_kind'],
                                          })
                                        }
                                        className="text-xs border rounded px-1 py-0.5"
                                      >
                                        <option value="standard">Standard</option>
                                        <option value="template">Template</option>
                                        <option value="combo">Combo</option>
                                        <option value="experience">Experience</option>
                                      </select>
                                    </label>
                                    <label className="flex items-center gap-1 text-xs text-muted-foreground">
                                      Serves:
                                      <input
                                        type="number"
                                        min="1"
                                        value={dish.serves ?? 1}
                                        onChange={e =>
                                          updateDish(mIdx, cIdx, dIdx, {
                                            serves: parseInt(e.target.value) || 1,
                                          })
                                        }
                                        className="w-12 text-xs border rounded px-1 py-0.5 text-center"
                                      />
                                    </label>
                                    <label className="flex items-center gap-1 text-xs text-muted-foreground">
                                      Price:
                                      <select
                                        value={dish.display_price_prefix ?? 'exact'}
                                        onChange={e =>
                                          updateDish(mIdx, cIdx, dIdx, {
                                            display_price_prefix: e.target.value as EditableDish['display_price_prefix'],
                                          })
                                        }
                                        className="text-xs border rounded px-1 py-0.5"
                                      >
                                        <option value="exact">Exact</option>
                                        <option value="from">From</option>
                                        <option value="per_person">Per person</option>
                                        <option value="market_price">Market price</option>
                                        <option value="ask_server">Ask server</option>
                                      </select>
                                    </label>
                                    {dish.is_parent && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-info/10 text-info">
                                        Parent ({dish.variant_ids?.length ?? 0} variants)
                                      </span>
                                    )}
                                    {dish.parent_id && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/30 text-muted-foreground">
                                        Variant
                                      </span>
                                    )}
                                  </div>

                                  {/* Dietary tags */}
                                  {dietaryTags.length > 0 && (
                                    <div>
                                      <p className="text-xs text-muted-foreground mb-1.5">Dietary Tags</p>
                                      <div className="flex flex-wrap gap-1.5">
                                        {dietaryTags.map(tag => {
                                          const active = dish.dietary_tags.includes(tag.code);
                                          return (
                                            <button
                                              key={tag.code}
                                              type="button"
                                              onClick={() => {
                                                const next = active
                                                  ? dish.dietary_tags.filter(c => c !== tag.code)
                                                  : [...dish.dietary_tags, tag.code];
                                                updateDish(mIdx, cIdx, dIdx, {
                                                  dietary_tags: next,
                                                });
                                              }}
                                              className={cn(
                                                'text-xs px-2 py-0.5 rounded-full border transition-colors',
                                                active
                                                  ? 'bg-success/10 border-success/30 text-success'
                                                  : 'bg-background border text-muted-foreground hover:border-input'
                                              )}
                                            >
                                              <span className="mr-0.5">
                                                {getDietaryTagIcon(tag.code)}
                                              </span>
                                              {tag.name}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}

                                  {/* Ingredients */}
                                  <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                      <p className="text-xs text-muted-foreground">Ingredients</p>
                                      <div className="flex items-center gap-1">
                                        {/* AI Suggest */}
                                        <button
                                          type="button"
                                          disabled={suggestingDishId === dish._id}
                                          onClick={() =>
                                            suggestIngredients(
                                              dish._id,
                                              dish.name,
                                              dish.description,
                                              mIdx,
                                              cIdx,
                                              dIdx
                                            )
                                          }
                                          className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100 disabled:opacity-50 transition-colors"
                                          title="Suggest ingredients from dish name & description"
                                        >
                                          {suggestingDishId === dish._id ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                          ) : (
                                            <Sparkles className="h-3 w-3" />
                                          )}
                                          Suggest
                                        </button>
                                        {/* Inline Add */}
                                        {!(
                                          inlineSearchTarget?.mIdx === mIdx &&
                                          inlineSearchTarget?.cIdx === cIdx &&
                                          inlineSearchTarget?.dIdx === dIdx
                                        ) && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setInlineSearchTarget({ mIdx, cIdx, dIdx })
                                            }
                                            className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-brand-primary/20 text-brand-primary bg-brand-primary/5 hover:bg-brand-primary/10 transition-colors"
                                          >
                                            <Plus className="h-3 w-3" />
                                            Add
                                          </button>
                                        )}
                                      </div>
                                    </div>

                                    {/* Ingredient pills */}
                                    {dish.ingredients.length > 0 && (
                                      <div className="flex flex-wrap gap-1.5 mb-1.5">
                                        {dish.ingredients.map((ing, ingIdx) => {
                                          const matched = ing.status === 'matched';
                                          const hasSubs = (ing.sub_ingredients?.length ?? 0) > 0;
                                          const isVariantActive =
                                            matched &&
                                            subIngredientEditTarget?.mIdx === mIdx &&
                                            subIngredientEditTarget?.cIdx === cIdx &&
                                            subIngredientEditTarget?.dIdx === dIdx &&
                                            subIngredientEditTarget?.ingIdx === ingIdx;

                                          return (
                                            <div
                                              key={ingIdx}
                                              className={cn(
                                                'text-xs rounded-full flex items-center',
                                                matched
                                                  ? 'bg-muted/30 text-foreground'
                                                  : 'bg-brand-primary/5 text-brand-primary border border-brand-primary/20'
                                              )}
                                            >
                                              {/* Pill body — opens re-link / link panel */}
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  setAddIngredientTarget({
                                                    menuIdx: mIdx,
                                                    catIdx: cIdx,
                                                    dishIdx: dIdx,
                                                    rawText: matched
                                                      ? ing.display_name || ing.raw_text
                                                      : ing.raw_text,
                                                  })
                                                }
                                                className={cn(
                                                  'flex items-center gap-1 pl-2 pr-0.5 py-0.5 rounded-l-full transition-colors',
                                                  matched
                                                    ? 'hover:bg-muted'
                                                    : 'hover:bg-brand-primary/10'
                                                )}
                                                title={
                                                  matched
                                                    ? `Re-link: ${ing.canonical_name}`
                                                    : 'Link to ingredient'
                                                }
                                              >
                                                {!matched && (
                                                  <AlertTriangle className="h-3 w-3 shrink-0" />
                                                )}
                                                {hasSubs && (
                                                  <Layers className="h-2.5 w-2.5 text-indigo-400 shrink-0" />
                                                )}
                                                <span>{ing.display_name || ing.raw_text}</span>
                                                {hasSubs && (
                                                  <span className="text-indigo-400 text-[10px]">
                                                    ({ing.sub_ingredients!.length})
                                                  </span>
                                                )}
                                              </button>
                                              {/* Variant toggle (matched only) */}
                                              {matched && (
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    setSubIngredientEditTarget(
                                                      isVariantActive
                                                        ? null
                                                        : { mIdx, cIdx, dIdx, ingIdx }
                                                    )
                                                  }
                                                  className={cn(
                                                    'px-0.5 py-0.5 transition-colors',
                                                    isVariantActive
                                                      ? 'text-indigo-500 bg-indigo-50 rounded'
                                                      : 'text-muted-foreground hover:text-indigo-500'
                                                  )}
                                                  title="Add/edit variants (e.g., choice of meat)"
                                                >
                                                  <Layers className="h-2.5 w-2.5" />
                                                </button>
                                              )}
                                              {/* Delete ingredient */}
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  removeIngredientFromDish(mIdx, cIdx, dIdx, ingIdx)
                                                }
                                                className={cn(
                                                  'flex items-center pr-1.5 py-0.5 rounded-r-full transition-colors',
                                                  matched
                                                    ? 'text-muted-foreground hover:text-destructive hover:bg-destructive/10'
                                                    : 'text-brand-primary/30 hover:text-destructive hover:bg-destructive/10'
                                                )}
                                                title="Remove ingredient"
                                              >
                                                <X className="h-2.5 w-2.5" />
                                              </button>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}

                                    {/* Sub-ingredient / variant editor */}
                                    {(() => {
                                      if (
                                        !subIngredientEditTarget ||
                                        subIngredientEditTarget.mIdx !== mIdx ||
                                        subIngredientEditTarget.cIdx !== cIdx ||
                                        subIngredientEditTarget.dIdx !== dIdx
                                      )
                                        return null;
                                      const parentIngIdx = subIngredientEditTarget.ingIdx;
                                      const parentIng = dish.ingredients[parentIngIdx];
                                      if (!parentIng || parentIng.status !== 'matched') return null;
                                      const subs = parentIng.sub_ingredients ?? [];
                                      return (
                                        <div className="border border-indigo-200 bg-indigo-50/40 rounded-lg p-2 mb-1.5">
                                          <div className="flex items-center justify-between mb-1.5">
                                            <p className="text-xs text-indigo-600 font-medium flex items-center gap-1">
                                              <Layers className="h-3 w-3" />
                                              Variants of &ldquo;
                                              {parentIng.display_name || parentIng.raw_text}
                                              &rdquo;
                                            </p>
                                            <button
                                              type="button"
                                              onClick={() => setSubIngredientEditTarget(null)}
                                              className="text-muted-foreground hover:text-foreground"
                                            >
                                              <X className="h-3.5 w-3.5" />
                                            </button>
                                          </div>
                                          {subs.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mb-1.5">
                                              {subs.map((sub, subIdx) => (
                                                <div
                                                  key={subIdx}
                                                  className="text-xs bg-indigo-100 text-indigo-700 rounded-full flex items-center"
                                                >
                                                  <span className="pl-2 pr-0.5 py-0.5">
                                                    {sub.display_name || sub.raw_text}
                                                  </span>
                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      removeSubIngredient(
                                                        mIdx,
                                                        cIdx,
                                                        dIdx,
                                                        parentIngIdx,
                                                        subIdx
                                                      )
                                                    }
                                                    className="pr-1.5 py-0.5 text-indigo-400 hover:text-destructive rounded-r-full transition-colors"
                                                    title="Remove variant"
                                                  >
                                                    <X className="h-2.5 w-2.5" />
                                                  </button>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                          <p className="text-[10px] text-indigo-400 mb-1">
                                            Search for specific variants (e.g., beef, chicken, pork)
                                          </p>
                                          <InlineIngredientSearch
                                            existingIds={
                                              new Set([
                                                ...(parentIng.canonical_ingredient_id
                                                  ? [parentIng.canonical_ingredient_id]
                                                  : []),
                                                ...subs
                                                  .map(s => s.canonical_ingredient_id)
                                                  .filter((id): id is string => Boolean(id)),
                                              ])
                                            }
                                            onAdd={sub =>
                                              addSubIngredient(mIdx, cIdx, dIdx, parentIngIdx, sub)
                                            }
                                            onClose={() => setSubIngredientEditTarget(null)}
                                          />
                                        </div>
                                      );
                                    })()}

                                    {/* Inline ingredient search */}
                                    {inlineSearchTarget?.mIdx === mIdx &&
                                      inlineSearchTarget?.cIdx === cIdx &&
                                      inlineSearchTarget?.dIdx === dIdx && (
                                        <InlineIngredientSearch
                                          existingIds={
                                            new Set(
                                              dish.ingredients
                                                .map(i => i.canonical_ingredient_id)
                                                .filter((id): id is string => Boolean(id))
                                            )
                                          }
                                          onAdd={ing => {
                                            addIngredientToDish(mIdx, cIdx, dIdx, ing);
                                          }}
                                          onClose={() => setInlineSearchTarget(null)}
                                        />
                                      )}

                                    {/* AI allergen hints */}
                                    {(dish.suggested_allergens ?? []).length > 0 && (
                                      <div className="flex flex-wrap items-center gap-1 mt-1.5 pt-1.5 border-t">
                                        <span className="text-xs text-muted-foreground mr-0.5">
                                          AI hints:
                                        </span>
                                        {dish.suggested_allergens!.map(code => (
                                          <span
                                            key={code}
                                            className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full"
                                            title="AI-suggested allergen — confirmed automatically from matched ingredients on save"
                                          >
                                            {getAllergenIcon(code)} {code.replace(/_/g, ' ')}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  {/* Dish category + extra fields row */}
                                  <div className="flex items-center gap-3 flex-wrap">
                                    <div className="flex-1 min-w-40">
                                      <p className="text-xs text-muted-foreground mb-1">Dish Category</p>
                                      <select
                                        value={dish.dish_category_id ?? ''}
                                        onChange={async e => {
                                          const val = e.target.value;
                                          if (val === '__new__') {
                                            const name = prompt('New category name:');
                                            if (!name?.trim()) return;
                                            const { data: created, error } =
                                              await createDishCategory({
                                                name: name.trim(),
                                                is_drink: false,
                                              });
                                            if (error || !created) {
                                              toast.error(
                                                `Failed to create category: ${error?.message ?? 'unknown'}`
                                              );
                                              return;
                                            }
                                            setDishCategories(prev =>
                                              [...prev, created].sort((a, b) =>
                                                a.name.localeCompare(b.name)
                                              )
                                            );
                                            updateDish(mIdx, cIdx, dIdx, {
                                              dish_category_id: created.id,
                                            });
                                            toast.success(`Category "${created.name}" created`);
                                          } else {
                                            updateDish(mIdx, cIdx, dIdx, {
                                              dish_category_id: val || null,
                                            });
                                          }
                                        }}
                                        className="w-full text-xs border border-input rounded px-2 py-1.5 bg-background focus:outline-none focus:border-brand-primary/70"
                                      >
                                        <option value="">— None —</option>
                                        {dishCategories.map(dc => (
                                          <option key={dc.id} value={dc.id}>
                                            {dc.name}
                                          </option>
                                        ))}
                                        <option value="__new__">➕ New category…</option>
                                      </select>
                                    </div>
                                    <div>
                                      <p className="text-xs text-muted-foreground mb-1">Spice</p>
                                      <select
                                        value={dish.spice_level ?? ''}
                                        onChange={e =>
                                          updateDish(mIdx, cIdx, dIdx, {
                                            spice_level:
                                              e.target.value === ''
                                                ? null
                                                : (e.target.value as 'none' | 'mild' | 'hot'),
                                          })
                                        }
                                        className="text-xs border border-input rounded px-2 py-1.5 bg-background focus:outline-none focus:border-brand-primary/70"
                                      >
                                        <option value="">—</option>
                                        <option value="none">No spice</option>
                                        <option value="mild">🌶️</option>
                                        <option value="hot">🌶️🌶️🌶️</option>
                                      </select>
                                    </div>
                                    <div>
                                      <p className="text-xs text-muted-foreground mb-1">Calories</p>
                                      <input
                                        type="number"
                                        value={dish.calories ?? ''}
                                        onChange={e =>
                                          updateDish(mIdx, cIdx, dIdx, {
                                            calories: e.target.value
                                              ? Number(e.target.value)
                                              : null,
                                          })
                                        }
                                        className="w-20 text-xs border border-input rounded px-2 py-1.5 focus:outline-none focus:border-brand-primary/70"
                                        placeholder="kcal"
                                        min="0"
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Add dish button */}
                        <button
                          onClick={() => addDish(mIdx, cIdx)}
                          className="w-full text-sm text-brand-primary hover:text-brand-primary/90 border border-dashed border-brand-primary/20 rounded-lg py-2 hover:border-brand-primary/30 hover:bg-brand-primary/5 transition-colors flex items-center justify-center gap-1"
                        >
                          <Plus className="h-4 w-4" /> Add Dish
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}

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
                onClick={handleSave}
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
      </div>

      {/* ---- Zoom Lightbox ---- */}
      {lightboxOpen && previewUrls.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-full transition-colors"
            onClick={() => setLightboxOpen(false)}
          >
            <X className="h-6 w-6" />
          </button>
          {previewUrls.length > 1 && (
            <>
              <button
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white p-3 hover:bg-white/10 rounded-full disabled:opacity-30 transition-colors"
                onClick={e => {
                  e.stopPropagation();
                  setCurrentImageIdx(i => Math.max(0, i - 1));
                }}
                disabled={currentImageIdx === 0}
              >
                <ChevronLeft className="h-8 w-8" />
              </button>
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white p-3 hover:bg-white/10 rounded-full disabled:opacity-30 transition-colors"
                onClick={e => {
                  e.stopPropagation();
                  setCurrentImageIdx(i => Math.min(previewUrls.length - 1, i + 1));
                }}
                disabled={currentImageIdx === previewUrls.length - 1}
              >
                <ChevronRight className="h-8 w-8" />
              </button>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-sm">
                {currentImageIdx + 1} / {previewUrls.length}
              </div>
            </>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrls[currentImageIdx]}
            alt="Menu zoom"
            className="max-w-[90vw] max-h-[90vh] object-contain shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

      {/* Add Ingredient slide-over */}
      {addIngredientTarget && (
        <AddIngredientPanel
          rawText={addIngredientTarget.rawText}
          onSuccess={resolved => {
            resolveIngredient(
              addIngredientTarget.menuIdx,
              addIngredientTarget.catIdx,
              addIngredientTarget.dishIdx,
              addIngredientTarget.rawText,
              resolved
            );
            setAddIngredientTarget(null);
          }}
          onClose={() => setAddIngredientTarget(null)}
        />
      )}
    </div>
  );
}
