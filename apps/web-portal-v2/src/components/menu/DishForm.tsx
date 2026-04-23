'use client';

import { useState, useTransition } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { PRIMARY_PROTEINS, type DishKind, type DishV2Input } from '@eatme/shared';
import { KindSelector } from './KindSelector';
import { BundleItemsSection } from './BundleItemsSection';
import { ConfigurableSlotsSection } from './ConfigurableSlotsSection';
import { CourseEditorSection } from './CourseEditorSection';
import type { ActionResult } from '@/lib/auth/wrappers';

// Flat form values — kind-specific arrays are always present but conditionally rendered.
// On submit we strip unneeded fields before calling the server action.
export type DishFormValues = {
  name: string;
  description: string;
  price: number;
  primary_protein: (typeof PRIMARY_PROTEINS)[number];
  dish_kind: DishKind;
  is_template: boolean;
  display_price_prefix: 'exact' | 'from' | 'per_person' | 'market_price' | 'ask_server';
  serves: number;
  is_available: boolean;
  dish_category_id: string;
  // kind-specific
  bundle_items: string[];
  slots: {
    name: string;
    description?: string;
    selection_type: 'single' | 'multiple' | 'quantity';
    min_selections: number;
    max_selections: number | null;
    options: { name: string; price_delta: number }[];
  }[];
  courses: {
    course_number: number;
    course_name?: string;
    required_count: number;
    choice_type: 'fixed' | 'one_of';
    items: { option_label: string; price_delta: number; sort_order: number }[];
  }[];
};

type OnSubmitFn = (input: DishV2Input) => Promise<ActionResult<{ id: string } | void>>;

interface DishFormProps {
  restaurantId: string;
  menuCategoryId: string;
  defaultValues?: Partial<DishFormValues>;
  onSubmit: OnSubmitFn;
  onCancel?: () => void;
  submitLabel?: string;
}

const DEFAULT_VALUES: DishFormValues = {
  name: '',
  description: '',
  price: 0,
  primary_protein: 'chicken',
  dish_kind: 'standard',
  is_template: false,
  display_price_prefix: 'exact',
  serves: 1,
  is_available: true,
  dish_category_id: '',
  bundle_items: [],
  slots: [],
  courses: [],
};

function buildDishInput(values: DishFormValues): DishV2Input {
  const base = {
    name: values.name,
    description: values.description || undefined,
    price: values.price,
    primary_protein: values.primary_protein,
    display_price_prefix: values.display_price_prefix,
    serves: values.serves,
    is_available: values.is_available,
    dish_category_id: values.dish_category_id || undefined,
    dietary_tags: [] as string[],
    allergens: [] as string[],
  };

  switch (values.dish_kind) {
    case 'standard':
      return { ...base, dish_kind: 'standard' };
    case 'bundle':
      return { ...base, dish_kind: 'bundle', bundle_items: values.bundle_items };
    case 'configurable':
      return {
        ...base,
        dish_kind: 'configurable',
        is_template: values.is_template,
        slots: values.slots,
      };
    case 'course_menu':
      return { ...base, dish_kind: 'course_menu', courses: values.courses };
    case 'buffet':
      return { ...base, dish_kind: 'buffet' };
    default:
      return { ...base, dish_kind: 'standard' };
  }
}

export function DishForm({
  defaultValues,
  onSubmit,
  onCancel,
  submitLabel = 'Save dish',
}: DishFormProps) {
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const methods = useForm<DishFormValues>({
    defaultValues: { ...DEFAULT_VALUES, ...defaultValues },
  });
  const {
    register,
    control,
    watch,
    setValue,
    handleSubmit,
    formState: { errors },
  } = methods;

  const dishKind = watch('dish_kind');

  const handleFormSubmit = (values: DishFormValues) => {
    setFormError(null);
    startTransition(async () => {
      const input = buildDishInput(values);
      const result = await onSubmit(input);
      if (!result.ok) {
        setFormError(result.formError ?? 'An error occurred. Please try again.');
      }
    });
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-5">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Name <span className="text-destructive">*</span>
          </label>
          <input
            {...register('name', { required: 'Dish name is required' })}
            className="w-full h-9 rounded border border-border px-3 text-sm"
            placeholder="e.g. Grilled Chicken"
            data-testid="dish-name"
          />
          {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            {...register('description')}
            rows={2}
            className="w-full rounded border border-border px-3 py-2 text-sm"
            placeholder="Optional description"
          />
        </div>

        {/* Price + prefix */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">
              Price <span className="text-destructive">*</span>
            </label>
            <input
              {...register('price', { valueAsNumber: true, min: 0 })}
              type="number"
              step="0.01"
              min="0"
              className="w-full h-9 rounded border border-border px-3 text-sm"
              data-testid="dish-price"
            />
          </div>
          <div className="w-40">
            <label className="block text-sm font-medium mb-1">Price type</label>
            <select
              {...register('display_price_prefix')}
              className="w-full h-9 rounded border border-border px-2 text-sm"
            >
              <option value="exact">Exact</option>
              <option value="from">From</option>
              <option value="per_person">Per person</option>
              <option value="market_price">Market price</option>
              <option value="ask_server">Ask server</option>
            </select>
          </div>
        </div>

        {/* Primary protein */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Primary protein <span className="text-destructive">*</span>
          </label>
          <select
            {...register('primary_protein')}
            className="w-full h-9 rounded border border-border px-2 text-sm"
            data-testid="dish-primary-protein"
          >
            {PRIMARY_PROTEINS.map(p => (
              <option key={p} value={p}>
                {p.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>

        {/* Dish kind */}
        <div>
          <label className="block text-sm font-medium mb-2">Dish kind</label>
          <div data-testid="dish-kind">
            <KindSelector value={dishKind} onChange={kind => setValue('dish_kind', kind)} />
          </div>
        </div>

        {/* is_template — only for configurable */}
        {dishKind === 'configurable' && (
          <div className="flex items-center gap-2">
            <input
              {...register('is_template')}
              type="checkbox"
              id="is_template"
              className="h-4 w-4"
              data-testid="dish-is-template"
            />
            <label htmlFor="is_template" className="text-sm">
              Reusable template (excluded from consumer feed)
            </label>
          </div>
        )}

        {/* Kind-specific sections */}
        {dishKind === 'bundle' && <BundleItemsSection />}
        {dishKind === 'configurable' && (
          <ConfigurableSlotsSection control={control} register={register} />
        )}
        {dishKind === 'course_menu' && (
          <CourseEditorSection control={control} register={register} />
        )}

        {/* Serves */}
        <div className="w-32">
          <label className="block text-sm font-medium mb-1">Serves</label>
          <input
            {...register('serves', { valueAsNumber: true, min: 1 })}
            type="number"
            min="1"
            className="w-full h-9 rounded border border-border px-3 text-sm"
          />
        </div>

        {/* Error */}
        {formError && (
          <p className="text-sm text-destructive" role="alert">
            {formError}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={isPending}
            className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm font-medium disabled:opacity-60"
            data-testid="dish-submit"
          >
            {isPending ? 'Saving…' : submitLabel}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-border rounded text-sm"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </FormProvider>
  );
}
