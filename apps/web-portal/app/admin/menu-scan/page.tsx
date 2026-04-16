'use client';

import { useMenuScan } from './hooks/useMenuScan';
import { MenuScanUpload } from './components/MenuScanUpload';
import { MenuScanReview } from './components/MenuScanReview';
import { ScanJobQueue } from './components/ScanJobQueue';

export default function MenuScanPage() {
  const state = useMenuScan();

  if (state.step === 'upload') {
    return (
      <div className="space-y-6">
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
          restaurantsWithoutMenu={state.restaurantsWithoutMenu}
        />
        <div className="max-w-2xl mx-auto">
          <ScanJobQueue
            jobs={state.jobs}
            onReview={state.enterReview}
            onDismiss={state.dismissJob}
          />
        </div>
      </div>
    );
  }

  return (
    <MenuScanReview
      selectedRestaurant={state.selectedRestaurant}
      currency={state.currency}
      menuWarnings={state.menuWarnings}
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
