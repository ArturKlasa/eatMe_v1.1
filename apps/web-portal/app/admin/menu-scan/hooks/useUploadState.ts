'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useReviewStore } from '../store';

/** Thin wrapper: manages React-specific effects (mount load, query-param preselect, ref) around the Zustand upload slice. */
export function useUploadState() {
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadRestaurants = useReviewStore(s => s.loadRestaurants);
  const selectRestaurantById = useReviewStore(s => s.selectRestaurantById);
  const setIsDragging = useReviewStore(s => s.setIsDragging);
  const handleFilesSelected = useReviewStore(s => s.handleFilesSelected);

  const restaurants = useReviewStore(s => s.restaurants);
  const restaurantSearch = useReviewStore(s => s.restaurantSearch);
  const showRestaurantDropdown = useReviewStore(s => s.showRestaurantDropdown);
  const selectedRestaurant = useReviewStore(s => s.selectedRestaurant);
  const isPreSelected = useReviewStore(s => s.isPreSelected);
  const showQuickAdd = useReviewStore(s => s.showQuickAdd);
  const quickAddInitialName = useReviewStore(s => s.quickAddInitialName);
  const imageFiles = useReviewStore(s => s.imageFiles);
  const previewUrls = useReviewStore(s => s.previewUrls);
  const isDragging = useReviewStore(s => s.isDragging);
  const isPdfConverting = useReviewStore(s => s.isPdfConverting);
  const currentImageIdx = useReviewStore(s => s.currentImageIdx);
  const restaurantsWithoutMenu = useReviewStore(s => s.restaurantsWithoutMenu);

  const setRestaurants = useReviewStore(s => s.setRestaurants);
  const setRestaurantSearch = useReviewStore(s => s.setRestaurantSearch);
  const setShowRestaurantDropdown = useReviewStore(s => s.setShowRestaurantDropdown);
  const setSelectedRestaurant = useReviewStore(s => s.setSelectedRestaurant);
  const setIsPreSelected = useReviewStore(s => s.setIsPreSelected);
  const setShowQuickAdd = useReviewStore(s => s.setShowQuickAdd);
  const setQuickAddInitialName = useReviewStore(s => s.setQuickAddInitialName);
  const setImageFiles = useReviewStore(s => s.setImageFiles);
  const setPreviewUrls = useReviewStore(s => s.setPreviewUrls);
  const setCurrentImageIdx = useReviewStore(s => s.setCurrentImageIdx);
  const skipRestaurantFromMenuScan = useReviewStore(s => s.skipRestaurantFromMenuScan);
  const removeImage = useReviewStore(s => s.removeImage);

  useEffect(() => {
    loadRestaurants();
  }, [loadRestaurants]);

  useEffect(() => {
    const restaurantId = searchParams.get('restaurant_id');
    if (!restaurantId) return;
    selectRestaurantById(restaurantId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const filteredRestaurants = restaurantSearch.trim()
    ? restaurants.filter(r => r.name.toLowerCase().includes(restaurantSearch.toLowerCase()))
    : restaurants;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const arr = Array.from(e.dataTransfer.files).filter(
      f => f.type.startsWith('image/') || f.type === 'application/pdf'
    );
    if (arr.length) handleFilesSelected(arr);
  };

  return {
    restaurants,
    setRestaurants,
    restaurantSearch,
    setRestaurantSearch,
    showRestaurantDropdown,
    setShowRestaurantDropdown,
    selectedRestaurant,
    setSelectedRestaurant,
    isPreSelected,
    setIsPreSelected,
    imageFiles,
    setImageFiles,
    previewUrls,
    setPreviewUrls,
    isDragging,
    isPdfConverting,
    fileInputRef,
    currentImageIdx,
    setCurrentImageIdx,
    showQuickAdd,
    setShowQuickAdd,
    quickAddInitialName,
    setQuickAddInitialName,
    restaurantsWithoutMenu,
    skipRestaurantFromMenuScan,
    filteredRestaurants,
    handleFilesSelected,
    removeImage,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
}
