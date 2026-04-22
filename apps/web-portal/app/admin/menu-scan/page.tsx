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
          skipRestaurantFromMenuScan={state.skipRestaurantFromMenuScan}
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

  return <MenuScanReview jobId={state.jobId} />;
}
