'use client';

import { useMenuScanStep } from './useMenuScanStep';
import { useUploadState } from './useUploadState';
import { useProcessingState } from './useProcessingState';
import { useReviewState } from './useReviewState';
import { useGroupState } from './useGroupState';

/**
 * Coordinator hook that composes all menu-scan sub-hooks.
 * Exposes the same API surface as the original useMenuScanState.
 */
export function useMenuScan() {
  const { step, setStep } = useMenuScanStep();
  const upload = useUploadState();
  const review = useReviewState({
    selectedRestaurant: upload.selectedRestaurant,
    previewUrls: upload.previewUrls,
    setStep,
  });
  const group = useGroupState({
    editableMenus: review.editableMenus,
    setEditableMenus: review.setEditableMenus,
    step,
    toggleExpand: review.toggleExpand,
  });
  const processing = useProcessingState({
    selectedRestaurant: upload.selectedRestaurant,
    imageFiles: upload.imageFiles,
    isPdfConverting: upload.isPdfConverting,
    setStep,
    onProcessingStart: restaurant => {
      review.setRestaurantDetails({
        address: '',
        city: restaurant.city || '',
        neighbourhood: '',
        state: '',
        postal_code: '',
        country_code: restaurant.country_code || 'MX',
        phone: '',
        website: '',
        lat: null,
        lng: null,
        dirty: false,
      });
      review.setLeftPanelTab('images');
    },
    onProcessingResult: result => {
      review.setJobId(result.jobId);
      review.setCurrency(result.currency);
      review.setEditableMenus(result.menus);
      review.setExpandedDishes(result.autoExpanded);
      group.setFlaggedDuplicates(result.flaggedDuplicates);
      upload.setCurrentImageIdx(0);
    },
  });

  const resetAll = () => {
    setStep('upload');
    upload.setSelectedRestaurant(null);
    upload.setRestaurantSearch('');
    upload.setImageFiles([]);
    upload.setPreviewUrls([]);
    review.setJobId('');
    review.setEditableMenus([]);
    review.setExpandedDishes(new Set());
    review.setSavedCount(0);
    processing.setProcessingError('');
    review.setRestaurantDetails({
      address: '',
      city: '',
      neighbourhood: '',
      state: '',
      postal_code: '',
      country_code: 'MX',
      phone: '',
      website: '',
      lat: null,
      lng: null,
      dirty: false,
    });
    review.setLightboxOpen(false);
    review.setLeftPanelTab('images');
    group.setSelectedGroupIds(new Set());
    group.setFocusedGroupId(null);
    group.setBatchFilters({ confidenceMin: null, dishKind: null, hasGrouping: null });
  };

  return {
    // Step
    step,
    setStep,

    // Upload
    restaurants: upload.restaurants,
    setRestaurants: upload.setRestaurants,
    restaurantSearch: upload.restaurantSearch,
    setRestaurantSearch: upload.setRestaurantSearch,
    showRestaurantDropdown: upload.showRestaurantDropdown,
    setShowRestaurantDropdown: upload.setShowRestaurantDropdown,
    selectedRestaurant: upload.selectedRestaurant,
    setSelectedRestaurant: upload.setSelectedRestaurant,
    isPreSelected: upload.isPreSelected,
    setIsPreSelected: upload.setIsPreSelected,
    imageFiles: upload.imageFiles,
    setImageFiles: upload.setImageFiles,
    previewUrls: upload.previewUrls,
    setPreviewUrls: upload.setPreviewUrls,
    isDragging: upload.isDragging,
    isPdfConverting: upload.isPdfConverting,
    fileInputRef: upload.fileInputRef,
    filteredRestaurants: upload.filteredRestaurants,
    handleFilesSelected: upload.handleFilesSelected,
    removeImage: upload.removeImage,
    handleDragOver: upload.handleDragOver,
    handleDragLeave: upload.handleDragLeave,
    handleDrop: upload.handleDrop,
    handleProcess: processing.handleProcess,
    showQuickAdd: upload.showQuickAdd,
    setShowQuickAdd: upload.setShowQuickAdd,
    quickAddInitialName: upload.quickAddInitialName,
    setQuickAddInitialName: upload.setQuickAddInitialName,

    // Processing
    processingError: processing.processingError,
    processingStage: processing.processingStage,

    // Review
    jobId: review.jobId,
    currency: review.currency,
    setCurrency: review.setCurrency,
    editableMenus: review.editableMenus,
    setEditableMenus: review.setEditableMenus,
    dishCategories: review.dishCategories,
    setDishCategories: review.setDishCategories,
    dietaryTags: review.dietaryTags,
    currentImageIdx: upload.currentImageIdx,
    setCurrentImageIdx: upload.setCurrentImageIdx,
    expandedDishes: review.expandedDishes,
    addIngredientTarget: review.addIngredientTarget,
    setAddIngredientTarget: review.setAddIngredientTarget,
    suggestingDishId: review.suggestingDishId,
    isSuggestingAll: review.isSuggestingAll,
    suggestAllProgress: review.suggestAllProgress,
    inlineSearchTarget: review.inlineSearchTarget,
    setInlineSearchTarget: review.setInlineSearchTarget,
    subIngredientEditTarget: review.subIngredientEditTarget,
    setSubIngredientEditTarget: review.setSubIngredientEditTarget,
    saving: review.saving,

    // Flagged duplicates
    flaggedDuplicates: group.flaggedDuplicates,

    // Batch
    selectedGroupIds: group.selectedGroupIds,
    setSelectedGroupIds: group.setSelectedGroupIds,
    batchFilters: group.batchFilters,
    setBatchFilters: group.setBatchFilters,
    focusedGroupId: group.focusedGroupId,
    setFocusedGroupId: group.setFocusedGroupId,

    // Done
    savedCount: review.savedCount,

    // Restaurant details
    restaurantDetails: review.restaurantDetails,
    updateRestaurantDetails: review.updateRestaurantDetails,

    // UI
    leftPanelTab: review.leftPanelTab,
    setLeftPanelTab: review.setLeftPanelTab,
    lightboxOpen: review.lightboxOpen,
    setLightboxOpen: review.setLightboxOpen,

    // Actions
    handleSave: review.handleSave,
    updateMenu: review.updateMenu,
    updateCategory: review.updateCategory,
    updateDish: review.updateDish,
    resolveIngredient: review.resolveIngredient,
    addIngredientToDish: review.addIngredientToDish,
    removeIngredientFromDish: review.removeIngredientFromDish,
    addSubIngredient: review.addSubIngredient,
    removeSubIngredient: review.removeSubIngredient,
    suggestIngredients: review.suggestIngredients,
    suggestAllDishes: review.suggestAllDishes,
    deleteDish: review.deleteDish,
    addDish: review.addDish,
    deleteCategory: review.deleteCategory,
    addCategory: review.addCategory,
    deleteMenu: review.deleteMenu,
    addMenu: review.addMenu,
    toggleExpand: review.toggleExpand,
    updateDishById: review.updateDishById,
    acceptGroup: group.acceptGroup,
    rejectGroup: group.rejectGroup,
    ungroupChild: group.ungroupChild,
    groupFlaggedDuplicate: group.groupFlaggedDuplicate,
    dismissFlaggedDuplicate: group.dismissFlaggedDuplicate,
    getParentGroups: group.getParentGroups,
    acceptHighConfidence: group.acceptHighConfidence,
    acceptSelected: group.acceptSelected,
    rejectSelected: group.rejectSelected,
    reviewedGroupCount: group.reviewedGroupCount,
    totalGroupCount: group.totalGroupCount,
    resetAll,

    // Convenience aliases
    uploadedFiles: upload.imageFiles,
    selectedDishes: group.selectedGroupIds,
  };
}
