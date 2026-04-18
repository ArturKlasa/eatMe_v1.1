'use client';

import { useState } from 'react';
import {
  Upload,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle2,
  ScanLine,
  X,
  Store,
  Plus,
  UtensilsCrossed,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  RestaurantForm,
  formDataToDbColumns,
  ADMIN_COMPACT_SECTIONS,
  type RestaurantFormData,
} from '@/components/admin/RestaurantForm';
import type { RestaurantOption } from '@/app/admin/menu-scan/hooks/menuScanTypes';

export interface MenuScanUploadProps {
  // Restaurant state
  restaurants: RestaurantOption[];
  setRestaurants: (
    v: RestaurantOption[] | ((prev: RestaurantOption[]) => RestaurantOption[])
  ) => void;
  restaurantSearch: string;
  setRestaurantSearch: (v: string) => void;
  showRestaurantDropdown: boolean;
  setShowRestaurantDropdown: (v: boolean) => void;
  selectedRestaurant: RestaurantOption | null;
  setSelectedRestaurant: (v: RestaurantOption | null) => void;
  isPreSelected: boolean;
  setIsPreSelected: (v: boolean) => void;
  filteredRestaurants: RestaurantOption[];

  // Quick-add
  showQuickAdd: boolean;
  setShowQuickAdd: (v: boolean | ((prev: boolean) => boolean)) => void;
  quickAddInitialName: string;
  setQuickAddInitialName: (v: string) => void;

  // Image state
  imageFiles: File[];
  previewUrls: string[];
  isDragging: boolean;
  isPdfConverting: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;

  // Handlers
  handleFilesSelected: (files: FileList | File[]) => Promise<void>;
  removeImage: (idx: number) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDragLeave: () => void;
  handleDrop: (e: React.DragEvent) => void;
  handleProcess: () => Promise<void>;

  // Restaurants without menus
  restaurantsWithoutMenu: RestaurantOption[];
  skipRestaurantFromMenuScan: (restaurantId: string) => Promise<void>;
}

export function MenuScanUpload({
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
  filteredRestaurants,
  showQuickAdd,
  setShowQuickAdd,
  quickAddInitialName,
  setQuickAddInitialName,
  imageFiles,
  previewUrls,
  isDragging,
  isPdfConverting,
  fileInputRef,
  handleFilesSelected,
  removeImage,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  handleProcess,
  restaurantsWithoutMenu,
  skipRestaurantFromMenuScan,
}: MenuScanUploadProps) {
  const [showNeedsMenu, setShowNeedsMenu] = useState(false);

  const handleSkipSelected = async () => {
    if (!selectedRestaurant) return;
    await skipRestaurantFromMenuScan(selectedRestaurant.id);
    setIsPreSelected(false);
    setSelectedRestaurant(null);
    setRestaurantSearch('');
    setShowRestaurantDropdown(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <ScanLine className="h-8 w-8 text-brand-primary" />
          Menu Scan
        </h1>
        <p className="mt-2 text-muted-foreground">
          Upload photos of a restaurant menu — AI extracts the dishes for you to review.
        </p>
      </div>

      {/* Restaurant selector */}
      <div className="bg-card rounded-xl border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground">1. Select Restaurant</h2>
          {!isPreSelected && (
            <button
              onClick={() => {
                setQuickAddInitialName(restaurantSearch);
                setShowQuickAdd(v => !v);
              }}
              className="flex items-center gap-1.5 text-sm text-brand-primary hover:text-brand-primary/80 font-medium"
            >
              <Store className="h-4 w-4" />
              New Restaurant
            </button>
          )}
        </div>

        {/* Pre-selected from query param */}
        {isPreSelected && selectedRestaurant && (
          <div className="flex items-center justify-between rounded-lg bg-success/10 border border-success/20 px-4 py-3">
            <p className="text-sm text-success flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
              <span className="font-medium">{selectedRestaurant.name}</span>
              {selectedRestaurant.city && (
                <span className="text-success">— {selectedRestaurant.city}</span>
              )}
            </p>
            <div className="flex items-center gap-3 ml-4 shrink-0">
              <a
                href={`https://www.google.com/maps/search/${encodeURIComponent([selectedRestaurant.name, selectedRestaurant.city].filter(Boolean).join(' '))}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                title="View on Google Maps"
              >
                <ExternalLink className="h-3 w-3" />
                Google Maps
              </a>
              <button
                onClick={handleSkipSelected}
                className="text-xs text-muted-foreground hover:text-destructive underline"
                title="Don't need a menu for this restaurant — remove from list"
              >
                Skip
              </button>
              <button
                onClick={() => {
                  setIsPreSelected(false);
                  setSelectedRestaurant(null);
                  setRestaurantSearch('');
                  setShowRestaurantDropdown(false);
                }}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Change
              </button>
            </div>
          </div>
        )}

        {/* Quick-add restaurant inline form */}
        {!isPreSelected && showQuickAdd && (
          <div className="max-h-[75vh] overflow-y-auto pr-1">
            <RestaurantForm
              mode="create"
              variant="compact"
              sections={ADMIN_COMPACT_SECTIONS}
              initialData={{ name: quickAddInitialName }}
              onSuccess={async (data: RestaurantFormData) => {
                const { data: userData } = await supabase.auth.getUser();
                if (!userData.user) {
                  toast.error('Not authenticated');
                  throw new Error('auth');
                }
                const { data: created, error } = await supabase
                  .from('restaurants')
                  .insert({
                    ...formDataToDbColumns(data),
                    owner_id: userData.user.id,
                    is_active: true,
                  })
                  .select('id, name, city, country_code')
                  .single();
                if (error || !created) {
                  toast.error('Failed to create restaurant');
                  throw error ?? new Error('No data returned');
                }
                const r: RestaurantOption = {
                  id: created.id,
                  name: created.name,
                  city: created.city,
                  country_code: created.country_code,
                };
                setRestaurants(prev => [...prev, r].sort((a, b) => a.name.localeCompare(b.name)));
                setSelectedRestaurant(r);
                setRestaurantSearch(r.name);
                setShowQuickAdd(false);
                setShowRestaurantDropdown(false);
              }}
              onCancel={() => setShowQuickAdd(false)}
            />
          </div>
        )}

        {!isPreSelected && !showQuickAdd && (
          <div className="relative">
            <Input
              value={restaurantSearch}
              onChange={e => {
                setRestaurantSearch(e.target.value);
                setSelectedRestaurant(null);
                setShowRestaurantDropdown(true);
              }}
              onFocus={() => setShowRestaurantDropdown(true)}
              placeholder="Search restaurant by name..."
              className="w-full"
            />
            {selectedRestaurant && (
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                <CheckCircle2 className="h-4 w-4 text-success" />
              </div>
            )}
            {showRestaurantDropdown && restaurantSearch.length > 0 && (
              <div className="absolute z-10 top-full mt-1 w-full bg-background border rounded-lg shadow-lg max-h-64 overflow-y-auto">
                {filteredRestaurants.length === 0 ? (
                  <button
                    className="w-full text-left px-4 py-3 text-sm text-brand-primary hover:bg-brand-primary/5 flex items-center gap-2"
                    onClick={() => {
                      setQuickAddInitialName(restaurantSearch);
                      setShowQuickAdd(true);
                      setShowRestaurantDropdown(false);
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    Create &ldquo;{restaurantSearch}&rdquo; as new restaurant
                  </button>
                ) : (
                  filteredRestaurants.slice(0, 20).map(r => (
                    <button
                      key={r.id}
                      className="w-full text-left px-4 py-2.5 hover:bg-accent text-sm border-b last:border-0"
                      onClick={() => {
                        setSelectedRestaurant(r);
                        setRestaurantSearch(r.name);
                        setShowRestaurantDropdown(false);
                      }}
                    >
                      <span className="font-medium">{r.name}</span>
                      {r.city && <span className="text-muted-foreground ml-2">— {r.city}</span>}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}
        {!isPreSelected && selectedRestaurant && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-success flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {selectedRestaurant.name}
              {selectedRestaurant.country_code && ` — ${selectedRestaurant.country_code}`}
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={handleSkipSelected}
                className="text-xs text-muted-foreground hover:text-destructive underline"
                title="Don't need a menu for this restaurant — remove from list"
              >
                Skip
              </button>
              <a
                href={`https://www.google.com/maps/search/${encodeURIComponent([selectedRestaurant.name, selectedRestaurant.city].filter(Boolean).join(' '))}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                title="View on Google Maps"
              >
                <ExternalLink className="h-3 w-3" />
                Google Maps
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Restaurants needing menus */}
      {restaurantsWithoutMenu.length > 0 && !isPreSelected && !selectedRestaurant && (
        <div className="bg-card rounded-xl border p-5">
          <button
            onClick={() => setShowNeedsMenu(v => !v)}
            className="w-full flex items-center justify-between text-sm font-medium text-foreground"
          >
            <span className="flex items-center gap-2">
              <UtensilsCrossed className="h-4 w-4 text-warning" />
              Restaurants needing menus ({restaurantsWithoutMenu.length})
            </span>
            {showNeedsMenu ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          {showNeedsMenu && (
            <div className="mt-3 max-h-52 overflow-y-auto space-y-0.5 border rounded-lg">
              {restaurantsWithoutMenu.map(r => (
                <button
                  key={r.id}
                  className="w-full text-left px-4 py-2 hover:bg-accent text-sm border-b last:border-0"
                  onClick={() => {
                    setSelectedRestaurant(r);
                    setRestaurantSearch(r.name);
                    setShowRestaurantDropdown(false);
                  }}
                >
                  <span className="font-medium">{r.name}</span>
                  {r.city && <span className="text-muted-foreground ml-2">— {r.city}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Image upload */}
      <div className="bg-background rounded-xl border p-6 space-y-4">
        <h2 className="font-semibold text-foreground">
          2. Upload Menu Photos or PDF (max 20 pages)
        </h2>

        <div
          data-testid="drop-zone"
          className={cn(
            'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors',
            isDragging
              ? 'border-brand-primary/70 bg-brand-primary/5'
              : 'border-input hover:border-brand-primary/50 hover:bg-brand-primary/5'
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !isPdfConverting && fileInputRef.current?.click()}
        >
          {isPdfConverting ? (
            <>
              <Loader2 className="h-10 w-10 mx-auto text-brand-primary/70 mb-3 animate-spin" />
              <p className="text-sm font-medium text-foreground">Converting PDF pages…</p>
              <p className="text-xs text-muted-foreground mt-1">This may take a few seconds</p>
            </>
          ) : (
            <>
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm font-medium text-foreground">
                Drag & drop photos or a PDF here, or click to browse
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                JPG, PNG, WEBP or PDF — up to 20 images/pages. Phone photos work fine.
              </p>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="hidden"
            onChange={e => e.target.files && handleFilesSelected(e.target.files)}
          />
        </div>

        {/* Thumbnails */}
        {previewUrls.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {previewUrls.map((url, idx) => (
              <div key={idx} className="relative group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Image ${idx + 1}`}
                  className="h-20 w-20 object-cover rounded-lg border"
                />
                <button
                  onClick={e => {
                    e.stopPropagation();
                    removeImage(idx);
                  }}
                  className="absolute -top-1.5 -right-1.5 bg-destructive text-background rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
                <span className="absolute bottom-1 right-1 text-[10px] bg-black/50 text-white px-1 rounded">
                  {idx + 1}
                </span>
              </div>
            ))}
            {imageFiles.length < 10 && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="h-20 w-20 rounded-lg border-2 border-dashed border-input flex items-center justify-center text-muted-foreground hover:border-brand-primary/50 hover:text-brand-primary/70 transition-colors"
              >
                <Plus className="h-6 w-6" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Submit */}
      <div className="flex justify-end">
        <Button
          onClick={handleProcess}
          disabled={!selectedRestaurant || imageFiles.length === 0}
          className="bg-brand-primary hover:bg-brand-primary/90 text-background px-8 py-3 text-base"
          size="lg"
        >
          <ScanLine className="h-5 w-5" />
          Extract with AI
        </Button>
      </div>
    </div>
  );
}
