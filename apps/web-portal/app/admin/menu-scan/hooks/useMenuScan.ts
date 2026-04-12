'use client';

import { useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { toEditableMenus } from '@/lib/menu-scan';
import { useMenuScanStep } from './useMenuScanStep';
import { useUploadState } from './useUploadState';
import { useProcessingState } from './useProcessingState';
import { useReviewState } from './useReviewState';
import { useGroupState } from './useGroupState';
import { useJobQueue } from './useJobQueue';
import type { ScanJob } from './menuScanTypes';

/**
 * Coordinator hook that composes all menu-scan sub-hooks.
 * Exposes the same API surface as the original useMenuScanState,
 * plus a background job queue.
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
  });
  const jobQueue = useJobQueue();

  // ---------- fire a scan and immediately reset the upload form ----------
  const handleProcess = useCallback(async () => {
    const fired = await processing.fireProcess();
    if (!fired) return;

    // Submit to the background job queue
    jobQueue.submitJob(fired.restaurantId, fired.restaurantName, fired.fetchPromise);
    toast.success(`Scan started for ${fired.restaurantName}`);

    // Reset upload form so the admin can start the next restaurant
    upload.setSelectedRestaurant(null);
    upload.setRestaurantSearch('');
    upload.setImageFiles([]);
    upload.setPreviewUrls(prev => {
      prev.forEach(url => URL.revokeObjectURL(url));
      return [];
    });
    upload.setIsPreSelected(false);
    upload.setShowQuickAdd(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processing.fireProcess, jobQueue.submitJob]);

  // ---------- enter review mode from a completed job ----------
  const enterReview = useCallback(
    async (tempId: string) => {
      const job = jobQueue.getJob(tempId);
      if (!job?.result || job.status !== 'needs_review') return;

      // Populate review state from the job result
      const menus = toEditableMenus(job.result.result);

      const autoExpanded = new Set<string>();
      menus.forEach(menu =>
        menu.categories.forEach(cat =>
          cat.dishes.forEach(dish => {
            if (dish.confidence < 0.7) autoExpanded.add(dish._id);
          })
        )
      );

      review.setJobId(job.jobId ?? '');
      review.setCurrency(job.result.currency);
      review.setEditableMenus(menus);
      review.setExpandedDishes(autoExpanded);
      review.setExtractionNotes(job.result.extractionNotes ?? []);
      group.setFlaggedDuplicates(job.result.flaggedDuplicates);

      // Set restaurant context for review
      upload.setSelectedRestaurant({
        id: job.restaurantId,
        name: job.restaurantName,
        city: null,
        country_code: null,
      });
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

      // Recover preview URLs from Supabase Storage
      if (job.imageStoragePaths?.length) {
        const urls = await Promise.all(
          job.imageStoragePaths.map(async (path: string) => {
            const { data } = await supabase.storage.from('menu-scans').createSignedUrl(path, 3600);
            return data?.signedUrl ?? '';
          })
        );
        upload.setPreviewUrls(urls.filter(Boolean));
      } else {
        upload.setPreviewUrls([]);
      }
      upload.setCurrentImageIdx(0);

      review.setLeftPanelTab('images');
      setStep('review');

      // Remove from queue since we're now reviewing it
      jobQueue.dismissJob(tempId);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [jobQueue.getJob, jobQueue.dismissJob]
  );

  const resetAll = () => {
    setStep('upload');
    upload.setSelectedRestaurant(null);
    upload.setRestaurantSearch('');
    upload.setImageFiles([]);
    upload.setPreviewUrls([]);
    review.setJobId('');
    review.setEditableMenus([]);
    review.setExpandedDishes(new Set());
    review.setExtractionNotes([]);
    review.setSavedCount(0);
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
    handleProcess,
    showQuickAdd: upload.showQuickAdd,
    setShowQuickAdd: upload.setShowQuickAdd,
    quickAddInitialName: upload.quickAddInitialName,
    setQuickAddInitialName: upload.setQuickAddInitialName,

    // Restaurants without menus
    restaurantsWithoutMenu: upload.restaurantsWithoutMenu,

    // Job queue
    jobs: jobQueue.jobs,
    enterReview,
    dismissJob: jobQueue.dismissJob,

    // Warnings
    menuWarnings: review.menuWarnings,

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
