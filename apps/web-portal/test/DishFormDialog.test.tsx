import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { DishBasicFields } from '@/components/forms/dish/DishBasicFields';
import { DishSpiceLevel } from '@/components/forms/dish/DishSpiceLevel';
import { DishDietarySection } from '@/components/forms/dish/DishDietarySection';
import { DishKindSelector } from '@/components/forms/dish/DishKindSelector';
import { DishVisibilityFields } from '@/components/forms/dish/DishVisibilityFields';
import { DishPhotoField } from '@/components/forms/dish/DishPhotoField';
import { DishCategorySelect } from '@/components/forms/dish/DishCategorySelect';
import { IngredientAutocomplete } from '@/components/IngredientAutocomplete';
import { DishFormDialog } from '@/components/forms/DishFormDialog';
import type { DishFormData } from '@eatme/shared';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          then: (cb: (result: { data: unknown[]; error: null }) => void) =>
            cb({ data: [], error: null }),
          order: () => ({
            then: (cb: (result: { data: unknown[]; error: null }) => void) =>
              cb({ data: [], error: null }),
          }),
        }),
      }),
      insert: () => ({ select: () => ({ single: () => ({ data: { id: 'test-id' }, error: null }) }) }),
      update: () => ({ eq: () => ({ select: () => ({ data: [{ id: 'test-id' }], error: null }) }) }),
      delete: () => ({ eq: () => ({ data: null, error: null }) }),
    }),
  },
}));

// Mock dish-categories with some test data
vi.mock('@/lib/dish-categories', () => ({
  fetchDishCategories: vi.fn().mockResolvedValue({
    data: [
      { id: 'cat-1', name: 'Pizza', is_drink: false },
      { id: 'cat-2', name: 'Salad', is_drink: false },
      { id: 'cat-3', name: 'Coffee', is_drink: true },
    ],
    error: null,
  }),
}));

// Mock cuisine-categories
vi.mock('@/lib/cuisine-categories', () => ({
  getCuisineCategories: vi.fn().mockReturnValue([]),
}));

// Mock ingredients search
const mockSearchIngredients = vi.fn().mockResolvedValue({ data: [], error: null });
vi.mock('@/lib/ingredients', () => ({
  searchIngredients: (...args: unknown[]) => mockSearchIngredients(...args),
}));

// sonner is globally mocked in test/setup.ts

// Mock validation schema
vi.mock('@/lib/validation', async () => {
  const actual = await vi.importActual('@/lib/validation');
  return actual;
});

// Wrapper that provides FormProvider context
function FormWrapper({ children, defaultValues }: { children: React.ReactNode; defaultValues?: Partial<DishFormData> }) {
  const Wrapper = () => {
    const methods = useForm<DishFormData>({
      defaultValues: {
        name: '',
        description: '',
        price: 0,
        calories: undefined,
        dietary_tags: [],
        allergens: [],
        spice_level: 'none',
        photo_url: '',
        is_available: true,
        dish_category_id: null,
        description_visibility: 'menu',
        ingredients_visibility: 'detail',
        dish_kind: 'standard',
        display_price_prefix: 'exact',
        serves: 1,
        option_groups: [],
        ...defaultValues,
      },
    });
    return <FormProvider {...methods}>{children}</FormProvider>;
  };
  return <Wrapper />;
}

describe('DishBasicFields', () => {
  it('renders name, description, price, calories, and serves fields', () => {
    render(
      <FormWrapper>
        <DishBasicFields />
      </FormWrapper>
    );

    expect(screen.getByLabelText(/dish name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/price/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/calories/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/serves/i)).toBeInTheDocument();
  });

  it('shows placeholder text', () => {
    render(
      <FormWrapper>
        <DishBasicFields />
      </FormWrapper>
    );

    expect(screen.getByPlaceholderText('e.g., Margherita Pizza')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('16.99')).toBeInTheDocument();
  });
});

describe('DishSpiceLevel', () => {
  it('renders spice level radio options', () => {
    render(
      <FormWrapper>
        <DishSpiceLevel />
      </FormWrapper>
    );

    expect(screen.getByText('Spice Level')).toBeInTheDocument();
    expect(screen.getByText('No spice')).toBeInTheDocument();
  });
});

describe('DishCategorySelect', () => {
  it('shows loading state initially', () => {
    render(
      <FormWrapper>
        <DishCategorySelect dishType="food" />
      </FormWrapper>
    );

    // The select trigger should exist with loading placeholder
    expect(screen.getByText(/dish category/i)).toBeInTheDocument();
  });

  it('renders categories after fetch', async () => {
    render(
      <FormWrapper>
        <DishCategorySelect dishType="food" />
      </FormWrapper>
    );

    // Wait for categories to load — the select should no longer be disabled
    await waitFor(() => {
      const trigger = screen.getByRole('combobox');
      expect(trigger).not.toBeDisabled();
    });
  });
});

describe('DishDietarySection', () => {
  it('renders vegetarian and vegan checkboxes', () => {
    render(
      <FormWrapper>
        <DishDietarySection />
      </FormWrapper>
    );

    expect(screen.getByText('Vegetarian/Vegan')).toBeInTheDocument();
    expect(screen.getByLabelText(/vegetarian/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/vegan/i)).toBeInTheDocument();
  });

  it('renders allergens section', () => {
    render(
      <FormWrapper>
        <DishDietarySection />
      </FormWrapper>
    );

    expect(screen.getByText('Allergens')).toBeInTheDocument();
    expect(screen.getByText('Mark allergens present in this dish')).toBeInTheDocument();
  });

  it('renders dietary tags section', () => {
    render(
      <FormWrapper>
        <DishDietarySection />
      </FormWrapper>
    );

    expect(screen.getByText('Dietary Tags')).toBeInTheDocument();
  });

  it('renders religious requirements section', () => {
    render(
      <FormWrapper>
        <DishDietarySection />
      </FormWrapper>
    );

    expect(screen.getByText('Religious Requirements')).toBeInTheDocument();
  });

  it('selecting vegan auto-checks vegetarian', async () => {
    render(
      <FormWrapper>
        <DishDietarySection />
      </FormWrapper>
    );

    const veganCheckbox = screen.getByLabelText(/vegan/i);
    const vegetarianCheckbox = screen.getByLabelText(/vegetarian/i);

    // Initially both unchecked
    expect(veganCheckbox).not.toBeChecked();
    expect(vegetarianCheckbox).not.toBeChecked();

    // Click vegan
    await act(async () => {
      fireEvent.click(veganCheckbox);
    });

    // Both should be checked
    await waitFor(() => {
      expect(veganCheckbox).toBeChecked();
      expect(vegetarianCheckbox).toBeChecked();
    });
  });
});

describe('DishKindSelector', () => {
  it('renders dish type radio options', () => {
    render(
      <FormWrapper>
        <DishKindSelector />
      </FormWrapper>
    );

    expect(screen.getByText('Dish Type')).toBeInTheDocument();
    expect(screen.getByText('Standard')).toBeInTheDocument();
    expect(screen.getByText('Template')).toBeInTheDocument();
  });

  it('selecting template shows option section indicator', async () => {
    render(
      <FormWrapper>
        <DishKindSelector />
      </FormWrapper>
    );

    // Get the Template radio input and click it
    const templateLabel = screen.getByText('Template');
    const templateRadio = templateLabel.closest('label')?.querySelector('input[type="radio"]');
    expect(templateRadio).toBeTruthy();

    await act(async () => {
      fireEvent.click(templateRadio!);
    });

    // Template radio should now be checked
    await waitFor(() => {
      expect(templateRadio).toBeChecked();
    });
  });
});

describe('DishVisibilityFields', () => {
  it('renders description visibility options', () => {
    render(
      <FormWrapper>
        <DishVisibilityFields />
      </FormWrapper>
    );

    expect(screen.getByText('Show description in app')).toBeInTheDocument();
    expect(screen.getByText(/menu list/i)).toBeInTheDocument();
    expect(screen.getByText(/dish detail only/i)).toBeInTheDocument();
  });
});

describe('DishPhotoField', () => {
  it('renders photo URL input', () => {
    render(
      <FormWrapper>
        <DishPhotoField />
      </FormWrapper>
    );

    expect(screen.getByText('Media')).toBeInTheDocument();
    expect(screen.getByLabelText(/photo url/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('https://example.com/photo.jpg')).toBeInTheDocument();
  });
});

describe('IngredientAutocomplete', () => {
  beforeEach(() => {
    mockSearchIngredients.mockReset();
    mockSearchIngredients.mockResolvedValue({ data: [], error: null });
  });

  it('has role="combobox" and aria-label on input', () => {
    render(
      <IngredientAutocomplete
        selectedIngredients={[]}
        onIngredientsChange={() => {}}
      />
    );

    const input = screen.getByRole('combobox');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-label', 'Search ingredients');
  });

  it('shows loading state during search', async () => {
    // Make search take a while
    mockSearchIngredients.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({ data: [], error: null }), 500))
    );

    render(
      <IngredientAutocomplete
        selectedIngredients={[]}
        onIngredientsChange={() => {}}
      />
    );

    const input = screen.getByRole('combobox');
    await act(async () => {
      fireEvent.change(input, { target: { value: 'chicken' } });
    });

    // Wait for debounce + loading state
    await waitFor(() => {
      // The loading spinner should appear
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    }, { timeout: 1000 });
  });

  it('shows error message on API failure', async () => {
    mockSearchIngredients.mockResolvedValue({ data: null, error: { message: 'Network error' } });

    render(
      <IngredientAutocomplete
        selectedIngredients={[]}
        onIngredientsChange={() => {}}
      />
    );

    const input = screen.getByRole('combobox');
    await act(async () => {
      fireEvent.change(input, { target: { value: 'chicken' } });
    });

    await waitFor(() => {
      expect(screen.getByText('Failed to search ingredients. Please try again.')).toBeInTheDocument();
    }, { timeout: 1000 });
  });

  it('renders empty state when no ingredients selected', () => {
    render(
      <IngredientAutocomplete
        selectedIngredients={[]}
        onIngredientsChange={() => {}}
      />
    );

    expect(screen.getByText('No ingredients added yet')).toBeInTheDocument();
  });
});

describe('DishFormDialog (integration)', () => {
  it('renders the full form when open', () => {
    render(
      <DishFormDialog
        isOpen={true}
        onClose={() => {}}
      />
    );

    expect(screen.getByText('Add New Dish')).toBeInTheDocument();
    expect(screen.getByText('Basic Information')).toBeInTheDocument();
    expect(screen.getByText('Spice Level')).toBeInTheDocument();
    expect(screen.getByText('Allergens')).toBeInTheDocument();
    expect(screen.getByText('Dish Type')).toBeInTheDocument();
    expect(screen.getByText('Media')).toBeInTheDocument();
  });

  it('shows Edit Dish title when dish prop is provided', () => {
    render(
      <DishFormDialog
        isOpen={true}
        onClose={() => {}}
        dish={{ id: 'test-123', name: 'Test Dish' }}
      />
    );

    expect(screen.getByText('Edit Dish')).toBeInTheDocument();
  });

  it('renders Add Dish and Cancel buttons', () => {
    render(
      <DishFormDialog
        isOpen={true}
        onClose={() => {}}
      />
    );

    expect(screen.getByRole('button', { name: /add dish/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <DishFormDialog
        isOpen={false}
        onClose={() => {}}
      />
    );

    expect(screen.queryByText('Add New Dish')).not.toBeInTheDocument();
  });
});
