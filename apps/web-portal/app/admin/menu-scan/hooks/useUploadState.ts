'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { pdfToImages } from '@/lib/menu-scan-utils';
import type { RestaurantOption } from './menuScanTypes';

/** Manages upload-phase state: restaurant selection, file handling, drag-drop, PDF conversion */
export function useUploadState() {
  const searchParams = useSearchParams();

  // ---------- restaurant selection ----------
  const [restaurants, setRestaurants] = useState<RestaurantOption[]>([]);
  const [restaurantSearch, setRestaurantSearch] = useState('');
  const [showRestaurantDropdown, setShowRestaurantDropdown] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState<RestaurantOption | null>(null);
  const [isPreSelected, setIsPreSelected] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddInitialName, setQuickAddInitialName] = useState('');

  // ---------- file handling ----------
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isPdfConverting, setIsPdfConverting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---------- image navigation ----------
  const [currentImageIdx, setCurrentImageIdx] = useState(0);

  // ---------- restaurants without menus ----------
  const [restaurantsWithoutMenu, setRestaurantsWithoutMenu] = useState<RestaurantOption[]>([]);

  // ---------- load restaurants on mount ----------
  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('restaurants')
        .select('id, name, city, country_code')
        .order('name');
      if (error) {
        console.error('[MenuScan] Failed to load restaurants:', error.message);
        return;
      }
      const all = (data as RestaurantOption[]) ?? [];
      setRestaurants(all);

      // "Needs menu" list = has zero dishes AND not flagged as skip_menu_scan
      const [{ data: dishRows }, { data: skipRows }] = await Promise.all([
        supabase.from('dishes').select('restaurant_id'),
        supabase.from('restaurants').select('id').eq('skip_menu_scan', true),
      ]);
      const withDishes = new Set(dishRows?.map(d => d.restaurant_id) ?? []);
      const skipped = new Set(skipRows?.map(r => r.id) ?? []);
      setRestaurantsWithoutMenu(all.filter(r => !withDishes.has(r.id) && !skipped.has(r.id)));
    };
    load();
  }, []);

  // ---------- skip a restaurant from the "needs menu" list ----------
  const skipRestaurantFromMenuScan = useCallback(async (restaurantId: string) => {
    const { error } = await supabase
      .from('restaurants')
      .update({ skip_menu_scan: true })
      .eq('id', restaurantId);
    if (error) {
      toast.error('Failed to skip restaurant');
      console.error('[MenuScan] skip_menu_scan update failed:', error.message);
      return;
    }
    setRestaurantsWithoutMenu(prev => prev.filter(r => r.id !== restaurantId));
    toast.success('Removed from list');
  }, []);

  // ---------- query-param restaurant pre-selection ----------
  useEffect(() => {
    const restaurantId = searchParams.get('restaurant_id');
    if (!restaurantId) return;

    supabase
      .from('restaurants')
      .select('id, name, city, country_code')
      .eq('id', restaurantId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          toast.warning('Restaurant not found — please select one from the list');
          return;
        }
        const r = data as RestaurantOption;
        setSelectedRestaurant(r);
        setRestaurantSearch(r.name);
        setIsPreSelected(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // ---------- filtered restaurant list ----------
  const filteredRestaurants = restaurantSearch.trim()
    ? restaurants.filter(r => r.name.toLowerCase().includes(restaurantSearch.toLowerCase()))
    : restaurants;

  // ---------- file selection helpers ----------
  const handleFilesSelected = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files);
      const images = arr.filter(f => f.type.startsWith('image/'));
      const pdfs = arr.filter(f => f.type === 'application/pdf');

      let allNew: File[] = [...images];

      if (pdfs.length > 0) {
        setIsPdfConverting(true);
        try {
          const pages = (await Promise.all(pdfs.map(f => pdfToImages(f)))).flat();
          allNew = [...allNew, ...pages];
          if (pages.length > 0) {
            toast.success(
              `Converted ${pdfs.length} PDF(s) → ${pages.length} page${pages.length !== 1 ? 's' : ''}`
            );
          }
        } catch (err) {
          console.error('[MenuScan] PDF conversion failed:', err);
          toast.error('Failed to read PDF — try saving pages as images instead');
        } finally {
          setIsPdfConverting(false);
        }
      }

      const combined = [...imageFiles, ...allNew].slice(0, 20);
      setImageFiles(combined);

      setPreviewUrls(prev => {
        prev.forEach(url => URL.revokeObjectURL(url));
        return combined.map(f => URL.createObjectURL(f));
      });
    },
    [imageFiles]
  );

  const removeImage = (idx: number) => {
    URL.revokeObjectURL(previewUrls[idx]);
    setImageFiles(prev => prev.filter((_, i) => i !== idx));
    setPreviewUrls(prev => prev.filter((_, i) => i !== idx));
    if (currentImageIdx >= imageFiles.length - 1) {
      setCurrentImageIdx(Math.max(0, imageFiles.length - 2));
    }
  };

  // ---------- drag & drop handlers ----------
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
