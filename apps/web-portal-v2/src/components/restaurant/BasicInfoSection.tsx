'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { restaurantBasicsSchema, type RestaurantBasicsInput } from '@eatme/shared';
import { updateRestaurantBasics } from '@/app/(app)/restaurant/[id]/actions/restaurant';

type FormValues = RestaurantBasicsInput;

export type RestaurantSnapshot = {
  id: string;
  name: string;
  description: string | null;
  restaurant_type: string | null;
  address: string;
  city: string | null;
  state: string | null;
  country_code: string | null;
  postal_code: string | null;
  neighbourhood: string | null;
  phone: string | null;
  website: string | null;
  cuisine_types: string[] | null;
  status: 'draft' | 'published' | 'archived';
  is_active: boolean | null;
};

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

function StatusChip({
  status,
  isActive,
}: {
  status: RestaurantSnapshot['status'];
  isActive: boolean | null;
}) {
  let label: string;
  let className: string;

  if (status === 'archived') {
    label = 'Archived';
    className = 'bg-gray-100 text-gray-600';
  } else if (status === 'published' && isActive === false) {
    label = 'Suspended';
    className = 'bg-yellow-100 text-yellow-800';
  } else if (status === 'published') {
    label = 'Live';
    className = 'bg-green-100 text-green-800';
  } else {
    label = 'Draft';
    className = 'bg-blue-100 text-blue-700';
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}

interface Props {
  initial: RestaurantSnapshot;
  mode?: 'onboarding' | 'edit';
  onValidChange?: (valid: boolean) => void;
}

export function BasicInfoSection({ initial, mode = 'edit', onValidChange }: Props) {
  const [saveState, setSaveState] = useState<SaveState>('idle');

  const form = useForm<FormValues>({
    resolver: zodResolver(restaurantBasicsSchema),
    defaultValues: {
      name: initial.name,
      description: initial.description ?? '',
      restaurant_type: initial.restaurant_type ?? '',
      country: initial.country_code ?? '',
      city: initial.city ?? '',
      postal_code: initial.postal_code ?? '',
      neighbourhood: initial.neighbourhood ?? '',
      state: initial.state ?? '',
      address: initial.address ?? '',
      phone: initial.phone ?? '',
      website: initial.website ?? '',
      cuisines: initial.cuisine_types ?? [],
    },
  });

  const autosave = form.handleSubmit(async values => {
    setSaveState('saving');
    onValidChange?.(true);
    const result = await updateRestaurantBasics(initial.id, values);
    if (!result.ok) {
      setSaveState('error');
      onValidChange?.(false);
      if (result.fieldErrors) {
        for (const [field, errors] of Object.entries(result.fieldErrors)) {
          form.setError(field as keyof FormValues, { message: errors[0] });
        }
      }
      return;
    }
    setSaveState('saved');
    setTimeout(() => setSaveState('idle'), 2000);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        {mode === 'onboarding' ? (
          <h2 className="text-xl font-semibold">Step 1: Basic Information</h2>
        ) : (
          <h1 className="text-2xl font-bold">Restaurant Details</h1>
        )}
        <div className="flex items-center gap-3">
          {mode === 'edit' && <StatusChip status={initial.status} isActive={initial.is_active} />}
          {saveState === 'saving' && (
            <span className="text-sm text-muted-foreground">Saving...</span>
          )}
          {saveState === 'saved' && <span className="text-sm text-green-600">Draft saved.</span>}
          {saveState === 'error' && <span className="text-sm text-red-600">Failed to save.</span>}
        </div>
      </div>

      <form className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-1">
            Restaurant name <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            {...form.register('name')}
            onBlur={autosave}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {form.formState.errors.name && (
            <p className="mt-1 text-xs text-red-600">{form.formState.errors.name.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium mb-1">
            Description
          </label>
          <textarea
            id="description"
            rows={3}
            {...form.register('description')}
            onBlur={autosave}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div>
          <label htmlFor="address" className="block text-sm font-medium mb-1">
            Address
          </label>
          <input
            id="address"
            {...form.register('address')}
            onBlur={autosave}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="city" className="block text-sm font-medium mb-1">
              City
            </label>
            <input
              id="city"
              {...form.register('city')}
              onBlur={autosave}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label htmlFor="state" className="block text-sm font-medium mb-1">
              State / Region
            </label>
            <input
              id="state"
              {...form.register('state')}
              onBlur={autosave}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="phone" className="block text-sm font-medium mb-1">
              Phone
            </label>
            <input
              id="phone"
              type="tel"
              {...form.register('phone')}
              onBlur={autosave}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="+1234567890"
            />
            {form.formState.errors.phone && (
              <p className="mt-1 text-xs text-red-600">{form.formState.errors.phone.message}</p>
            )}
          </div>
          <div>
            <label htmlFor="website" className="block text-sm font-medium mb-1">
              Website
            </label>
            <input
              id="website"
              type="url"
              {...form.register('website')}
              onBlur={autosave}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="https://example.com"
            />
            {form.formState.errors.website && (
              <p className="mt-1 text-xs text-red-600">{form.formState.errors.website.message}</p>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
