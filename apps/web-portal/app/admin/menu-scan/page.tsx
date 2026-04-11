'use client';

import { useMenuScanState } from './hooks/useMenuScanState';
import { MenuScanUpload } from './components/MenuScanUpload';
import { MenuScanProcessing } from './components/MenuScanProcessing';
import { MenuScanReview } from './components/MenuScanReview';
import { MenuScanDone } from './components/MenuScanDone';

export default function MenuScanPage() {
  const state = useMenuScanState();

  if (state.step === 'upload') {
    return (
      <MenuScanUpload
        restaurants={state.restaurants}
        setRestaurants={state.setRestaurants}
        restaurantSearch={state.restaurantSearch}
        setRestaurantSearch={state.setRestaurantSearch}
        showRestaurantDropdown={state.showRestaurantDropdown}
        setShowRestaurantDropdown={state.setShowRestaurantDropdown}
        selectedRestaurant={state.selectedRestaurant}
        setSelectedRestaurant={state.setSelectedRestaurant}
        isPreSelected={state.isPreSelected}
        setIsPreSelected={state.setIsPreSelected}
        filteredRestaurants={state.filteredRestaurants}
        showQuickAdd={state.showQuickAdd}
        setShowQuickAdd={state.setShowQuickAdd}
        quickAddInitialName={state.quickAddInitialName}
        setQuickAddInitialName={state.setQuickAddInitialName}
        imageFiles={state.imageFiles}
        previewUrls={state.previewUrls}
        isDragging={state.isDragging}
        isPdfConverting={state.isPdfConverting}
        fileInputRef={state.fileInputRef}
        handleFilesSelected={state.handleFilesSelected}
        removeImage={state.removeImage}
        handleDragOver={state.handleDragOver}
        handleDragLeave={state.handleDragLeave}
        handleDrop={state.handleDrop}
        handleProcess={state.handleProcess}
        processingError={state.processingError}
      />
    );
  }

  if (state.step === 'processing') {
    return (
      <MenuScanProcessing
        imageFiles={state.imageFiles}
        selectedRestaurant={state.selectedRestaurant}
        processingStage={state.processingStage}
        restaurantDetails={state.restaurantDetails}
        updateRestaurantDetails={state.updateRestaurantDetails}
      />
    );
  }

  if (state.step === 'done') {
    return (
      <MenuScanDone
        savedCount={state.savedCount}
        selectedRestaurant={state.selectedRestaurant}
        resetAll={state.resetAll}
      />
    );
  }

  return (
    <MenuScanReview
      selectedRestaurant={state.selectedRestaurant}
      currency={state.currency}
      imageFiles={state.imageFiles}
      previewUrls={state.previewUrls}
      editableMenus={state.editableMenus}
      setEditableMenus={state.setEditableMenus}
      dishCategories={state.dishCategories}
      setDishCategories={state.setDishCategories}
      dietaryTags={state.dietaryTags}
      currentImageIdx={state.currentImageIdx}
      setCurrentImageIdx={state.setCurrentImageIdx}
      expandedDishes={state.expandedDishes}
      addIngredientTarget={state.addIngredientTarget}
      setAddIngredientTarget={state.setAddIngredientTarget}
      suggestingDishId={state.suggestingDishId}
      isSuggestingAll={state.isSuggestingAll}
      suggestAllProgress={state.suggestAllProgress}
      inlineSearchTarget={state.inlineSearchTarget}
      setInlineSearchTarget={state.setInlineSearchTarget}
      subIngredientEditTarget={state.subIngredientEditTarget}
      setSubIngredientEditTarget={state.setSubIngredientEditTarget}
      saving={state.saving}
      flaggedDuplicates={state.flaggedDuplicates}
      selectedGroupIds={state.selectedGroupIds}
      setSelectedGroupIds={state.setSelectedGroupIds}
      batchFilters={state.batchFilters}
      setBatchFilters={state.setBatchFilters}
      focusedGroupId={state.focusedGroupId}
      setFocusedGroupId={state.setFocusedGroupId}
      restaurantDetails={state.restaurantDetails}
      updateRestaurantDetails={state.updateRestaurantDetails}
      leftPanelTab={state.leftPanelTab}
      setLeftPanelTab={state.setLeftPanelTab}
      lightboxOpen={state.lightboxOpen}
      setLightboxOpen={state.setLightboxOpen}
      reviewedGroupCount={state.reviewedGroupCount}
      totalGroupCount={state.totalGroupCount}
      setStep={state.setStep}
      handleSave={state.handleSave}
      updateMenu={state.updateMenu}
      updateCategory={state.updateCategory}
      updateDish={state.updateDish}
      resolveIngredient={state.resolveIngredient}
      addIngredientToDish={state.addIngredientToDish}
      removeIngredientFromDish={state.removeIngredientFromDish}
      addSubIngredient={state.addSubIngredient}
      removeSubIngredient={state.removeSubIngredient}
      suggestIngredients={state.suggestIngredients}
      suggestAllDishes={state.suggestAllDishes}
      deleteDish={state.deleteDish}
      addDish={state.addDish}
      deleteCategory={state.deleteCategory}
      addCategory={state.addCategory}
      deleteMenu={state.deleteMenu}
      addMenu={state.addMenu}
      toggleExpand={state.toggleExpand}
      updateDishById={state.updateDishById}
      acceptGroup={state.acceptGroup}
      rejectGroup={state.rejectGroup}
      ungroupChild={state.ungroupChild}
      groupFlaggedDuplicate={state.groupFlaggedDuplicate}
      dismissFlaggedDuplicate={state.dismissFlaggedDuplicate}
      acceptHighConfidence={state.acceptHighConfidence}
      acceptSelected={state.acceptSelected}
      rejectSelected={state.rejectSelected}
    />
  );
}
