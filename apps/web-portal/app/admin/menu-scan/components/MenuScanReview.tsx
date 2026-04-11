'use client';

import { AddIngredientPanel } from '@/components/admin/AddIngredientPanel';
import { type EditableDish, type EditableMenu, countDishes } from '@/lib/menu-scan';
import type {
  RestaurantOption,
  RestaurantDetailsForm,
  AddIngredientTarget,
  DietaryTagOption,
} from '@/app/admin/menu-scan/hooks/menuScanTypes';
import type { EditableIngredient, FlaggedDuplicate } from '@/lib/menu-scan';
import type { DishCategory } from '@/lib/dish-categories';
import type { BatchFilters } from '@/components/admin/menu-scan/BatchToolbar';
import { ReviewHeader } from './ReviewHeader';
import { ReviewLeftPanel } from './ReviewLeftPanel';
import { MenuExtractionList } from './MenuExtractionList';
import { ImageZoomLightbox } from './ImageZoomLightbox';

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

export function MenuScanReview(props: MenuScanReviewProps) {
  const {
    imageFiles,
    editableMenus,
    addIngredientTarget,
    setAddIngredientTarget,
    resolveIngredient,
    lightboxOpen,
    setLightboxOpen,
    previewUrls,
    currentImageIdx,
    setCurrentImageIdx,
    leftPanelTab,
    setLeftPanelTab,
    restaurantDetails,
    updateRestaurantDetails,
  } = props;

  const totalDishes = countDishes(editableMenus);

  return (
    <div className="flex flex-col h-[calc(100vh-140px)]">
      <ReviewHeader
        selectedRestaurant={props.selectedRestaurant}
        currency={props.currency}
        totalDishes={totalDishes}
        imageFileCount={imageFiles.length}
        saving={props.saving}
        setStep={props.setStep}
        handleSave={props.handleSave}
      />

      {/* Two-panel body */}
      <div className="flex gap-5 min-h-0 flex-1">
        <ReviewLeftPanel
          leftPanelTab={leftPanelTab}
          setLeftPanelTab={setLeftPanelTab}
          previewUrls={previewUrls}
          currentImageIdx={currentImageIdx}
          setCurrentImageIdx={setCurrentImageIdx}
          setLightboxOpen={setLightboxOpen}
          restaurantDetails={restaurantDetails}
          updateRestaurantDetails={updateRestaurantDetails}
        />

        <MenuExtractionList
          currency={props.currency}
          editableMenus={editableMenus}
          dishCategories={props.dishCategories}
          setDishCategories={props.setDishCategories}
          dietaryTags={props.dietaryTags}
          expandedDishes={props.expandedDishes}
          addIngredientTarget={addIngredientTarget}
          setAddIngredientTarget={setAddIngredientTarget}
          suggestingDishId={props.suggestingDishId}
          isSuggestingAll={props.isSuggestingAll}
          suggestAllProgress={props.suggestAllProgress}
          inlineSearchTarget={props.inlineSearchTarget}
          setInlineSearchTarget={props.setInlineSearchTarget}
          subIngredientEditTarget={props.subIngredientEditTarget}
          setSubIngredientEditTarget={props.setSubIngredientEditTarget}
          saving={props.saving}
          flaggedDuplicates={props.flaggedDuplicates}
          selectedGroupIds={props.selectedGroupIds}
          setSelectedGroupIds={props.setSelectedGroupIds}
          batchFilters={props.batchFilters}
          setBatchFilters={props.setBatchFilters}
          focusedGroupId={props.focusedGroupId}
          setFocusedGroupId={props.setFocusedGroupId}
          reviewedGroupCount={props.reviewedGroupCount}
          totalGroupCount={props.totalGroupCount}
          setStep={props.setStep}
          handleSave={props.handleSave}
          updateMenu={props.updateMenu}
          updateCategory={props.updateCategory}
          updateDish={props.updateDish}
          resolveIngredient={resolveIngredient}
          addIngredientToDish={props.addIngredientToDish}
          removeIngredientFromDish={props.removeIngredientFromDish}
          addSubIngredient={props.addSubIngredient}
          removeSubIngredient={props.removeSubIngredient}
          suggestIngredients={props.suggestIngredients}
          suggestAllDishes={props.suggestAllDishes}
          deleteDish={props.deleteDish}
          addDish={props.addDish}
          deleteCategory={props.deleteCategory}
          addCategory={props.addCategory}
          deleteMenu={props.deleteMenu}
          addMenu={props.addMenu}
          toggleExpand={props.toggleExpand}
          updateDishById={props.updateDishById}
          acceptGroup={props.acceptGroup}
          rejectGroup={props.rejectGroup}
          ungroupChild={props.ungroupChild}
          groupFlaggedDuplicate={props.groupFlaggedDuplicate}
          dismissFlaggedDuplicate={props.dismissFlaggedDuplicate}
          acceptHighConfidence={props.acceptHighConfidence}
          acceptSelected={props.acceptSelected}
          rejectSelected={props.rejectSelected}
        />
      </div>

      <ImageZoomLightbox
        lightboxOpen={lightboxOpen}
        setLightboxOpen={setLightboxOpen}
        previewUrls={previewUrls}
        currentImageIdx={currentImageIdx}
        setCurrentImageIdx={setCurrentImageIdx}
      />

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
