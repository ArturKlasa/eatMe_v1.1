import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MenuScanUpload } from '@/app/admin/menu-scan/components/MenuScanUpload';
import { MenuScanProcessing } from '@/app/admin/menu-scan/components/MenuScanProcessing';
import { MenuScanDone } from '@/app/admin/menu-scan/components/MenuScanDone';
import { MenuScanReview } from '@/app/admin/menu-scan/components/MenuScanReview';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// sonner is globally mocked in test/setup.ts

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock('next/dynamic', () => ({
  default: (_fn: unknown) => {
    const Component = () => <div data-testid="location-picker-loading">Loading map…</div>;
    Component.displayName = 'DynamicComponent';
    return Component;
  },
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      then: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
  },
  formatLocationForSupabase: vi.fn(),
}));

vi.mock('@/components/admin/RestaurantForm', () => ({
  RestaurantForm: () => <div data-testid="restaurant-form">RestaurantForm</div>,
  formDataToDbColumns: vi.fn(),
  ADMIN_COMPACT_SECTIONS: [],
}));

vi.mock('@/components/admin/AddIngredientPanel', () => ({
  AddIngredientPanel: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="add-ingredient-panel">
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

vi.mock('@/components/admin/InlineIngredientSearch', () => ({
  InlineIngredientSearch: () => <div data-testid="inline-ingredient-search" />,
}));

vi.mock('@/components/admin/menu-scan/DishGroupCard', () => ({
  DishGroupCard: () => <div data-testid="dish-group-card" />,
}));

vi.mock('@/components/admin/menu-scan/BatchToolbar', () => ({
  BatchToolbar: () => <div data-testid="batch-toolbar" />,
}));

vi.mock('@/components/admin/menu-scan/FlaggedDuplicateCard', () => ({
  FlaggedDuplicateCard: () => <div data-testid="flagged-duplicate-card" />,
}));

vi.mock('@/lib/icons', () => ({
  getDietaryTagIcon: vi.fn().mockReturnValue('🌱'),
  getAllergenIcon: vi.fn().mockReturnValue('⚠'),
}));

vi.mock('@/lib/dish-categories', () => ({
  createDishCategory: vi.fn().mockResolvedValue({ data: null, error: null }),
}));

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const mockRestaurant = {
  id: 'r1',
  name: 'Test Restaurant',
  city: 'Mexico City',
  country_code: 'MX',
};

const mockRestaurantDetails = {
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
};

const noOp = () => {};
const asyncNoOp = async () => {};

// ---------------------------------------------------------------------------
// MenuScanUpload tests
// ---------------------------------------------------------------------------

describe('MenuScanUpload', () => {
  const defaultProps = {
    restaurants: [],
    setRestaurants: noOp,
    restaurantSearch: '',
    setRestaurantSearch: noOp,
    showRestaurantDropdown: false,
    setShowRestaurantDropdown: noOp,
    selectedRestaurant: null,
    setSelectedRestaurant: noOp,
    isPreSelected: false,
    setIsPreSelected: noOp,
    filteredRestaurants: [],
    showQuickAdd: false,
    setShowQuickAdd: noOp,
    quickAddInitialName: '',
    setQuickAddInitialName: noOp,
    imageFiles: [],
    previewUrls: [],
    isDragging: false,
    isPdfConverting: false,
    fileInputRef: { current: null },
    handleFilesSelected: asyncNoOp,
    removeImage: noOp,
    handleDragOver: noOp,
    handleDragLeave: noOp,
    handleDrop: noOp,
    handleProcess: asyncNoOp,
    restaurantsWithoutMenu: [],
  };

  it('renders drop zone', () => {
    render(<MenuScanUpload {...defaultProps} />);
    expect(screen.getByTestId('drop-zone')).toBeInTheDocument();
  });

  it('renders "Extract with AI" button disabled when no restaurant selected', () => {
    render(<MenuScanUpload {...defaultProps} />);
    const button = screen.getByRole('button', { name: /extract with ai/i });
    expect(button).toBeDisabled();
  });

  it('renders restaurants without menus section when available', () => {
    render(
      <MenuScanUpload
        {...defaultProps}
        restaurantsWithoutMenu={[
          { id: '1', name: 'Test Restaurant', city: 'NYC', country_code: 'US' },
        ]}
      />
    );
    expect(screen.getByText(/restaurants needing menus/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// MenuScanProcessing tests
// ---------------------------------------------------------------------------

describe('MenuScanProcessing', () => {
  const defaultProps = {
    imageFiles: [new File([''], 'menu.jpg', { type: 'image/jpeg' })],
    selectedRestaurant: mockRestaurant,
    processingStage: 'analyzing' as const,
    restaurantDetails: mockRestaurantDetails,
    updateRestaurantDetails: noOp,
  };

  it('renders "Extracting menu…" heading', () => {
    render(<MenuScanProcessing {...defaultProps} />);
    expect(screen.getByText('Extracting menu…')).toBeInTheDocument();
  });

  it('shows stage labels', () => {
    render(<MenuScanProcessing {...defaultProps} />);
    expect(screen.getByText('Resizing images')).toBeInTheDocument();
    expect(screen.getByText('Sending to AI')).toBeInTheDocument();
    expect(screen.getByText('Analysing menu')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// MenuScanDone tests
// ---------------------------------------------------------------------------

describe('MenuScanDone', () => {
  it('renders "Saved Successfully!" heading', () => {
    render(<MenuScanDone savedCount={12} selectedRestaurant={mockRestaurant} resetAll={noOp} />);
    expect(screen.getByText('Saved Successfully!')).toBeInTheDocument();
    expect(screen.getByText(/12 dishes/)).toBeInTheDocument();
  });

  it('calls resetAll when "Scan Another Menu" clicked', async () => {
    const resetAll = vi.fn();
    render(<MenuScanDone savedCount={5} selectedRestaurant={mockRestaurant} resetAll={resetAll} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /scan another menu/i }));
    expect(resetAll).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// MenuScanReview tests
// ---------------------------------------------------------------------------

describe('MenuScanReview', () => {
  const defaultProps = {
    selectedRestaurant: mockRestaurant,
    currency: 'MXN',
    imageFiles: [],
    previewUrls: [],
    editableMenus: [
      {
        name: 'Lunch',
        menu_type: 'food' as const,
        categories: [
          {
            name: 'Starters',
            dishes: [
              {
                _id: 'd1',
                name: 'Tacos',
                price: '80',
                description: '',
                confidence: 0.9,
                ingredients: [],
                dietary_tags: [],
                is_parent: false,
                parent_id: null,
                variant_ids: [],
                group_status: 'none' as const,
                dish_kind: 'standard' as const,
                serves: 1,
                display_price_prefix: 'exact' as const,
                spice_level: null,
                calories: null,
                dish_category_id: null,
                suggested_allergens: [],
              },
            ],
          },
        ],
      },
    ],
    setEditableMenus: noOp,
    dishCategories: [],
    setDishCategories: noOp,
    dietaryTags: [],
    currentImageIdx: 0,
    setCurrentImageIdx: noOp,
    expandedDishes: new Set<string>(),
    addIngredientTarget: null,
    setAddIngredientTarget: noOp,
    suggestingDishId: null,
    isSuggestingAll: false,
    suggestAllProgress: null,
    inlineSearchTarget: null,
    setInlineSearchTarget: noOp,
    subIngredientEditTarget: null,
    setSubIngredientEditTarget: noOp,
    saving: false,
    flaggedDuplicates: [],
    selectedGroupIds: new Set<string>(),
    setSelectedGroupIds: noOp,
    batchFilters: { confidenceMin: null, dishKind: null, hasGrouping: null },
    setBatchFilters: noOp,
    focusedGroupId: null,
    setFocusedGroupId: noOp,
    restaurantDetails: mockRestaurantDetails,
    updateRestaurantDetails: noOp,
    leftPanelTab: 'images' as const,
    setLeftPanelTab: noOp,
    lightboxOpen: false,
    setLightboxOpen: noOp,
    reviewedGroupCount: 0,
    totalGroupCount: 0,
    setStep: noOp,
    handleSave: asyncNoOp,
    updateMenu: noOp,
    updateCategory: noOp,
    updateDish: noOp,
    resolveIngredient: noOp,
    addIngredientToDish: noOp,
    removeIngredientFromDish: noOp,
    addSubIngredient: noOp,
    removeSubIngredient: noOp,
    suggestIngredients: asyncNoOp,
    suggestAllDishes: asyncNoOp,
    deleteDish: noOp,
    addDish: noOp,
    deleteCategory: noOp,
    addCategory: noOp,
    deleteMenu: noOp,
    addMenu: noOp,
    toggleExpand: noOp,
    updateDishById: noOp,
    acceptGroup: noOp,
    rejectGroup: noOp,
    ungroupChild: noOp,
    groupFlaggedDuplicate: noOp,
    dismissFlaggedDuplicate: noOp,
    acceptHighConfidence: noOp,
    acceptSelected: noOp,
    rejectSelected: noOp,
    menuWarnings: [],
  };

  it('renders dish count', () => {
    render(<MenuScanReview {...defaultProps} />);
    expect(screen.getByText(/1 dish extracted/)).toBeInTheDocument();
  });

  it('renders "Save X dishes to DB" button', () => {
    render(<MenuScanReview {...defaultProps} />);
    expect(screen.getByRole('button', { name: /save 1 dishes to db/i })).toBeInTheDocument();
  });
});
