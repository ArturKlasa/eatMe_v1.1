'use client';

import { useFormContext } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { DishFormData } from '@eatme/shared';

const PROTEIN_GROUPS = [
  {
    label: 'Meat',
    options: [
      { value: 'chicken', label: 'Chicken' },
      { value: 'beef', label: 'Beef' },
      { value: 'pork', label: 'Pork' },
      { value: 'lamb', label: 'Lamb' },
      { value: 'duck', label: 'Duck' },
      { value: 'other_meat', label: 'Other meat' },
    ],
  },
  {
    label: 'Fish & Seafood',
    options: [
      { value: 'fish', label: 'Fish' },
      { value: 'shellfish', label: 'Seafood' },
    ],
  },
  {
    label: 'Other Animal',
    options: [{ value: 'eggs', label: 'Eggs' }],
  },
  {
    label: 'Plant-Based',
    options: [
      { value: 'vegetarian', label: 'Vegetarian' },
      { value: 'vegan', label: 'Vegan' },
    ],
  },
] as const;

export function DishPrimaryProteinSelect() {
  const { setValue, watch } = useFormContext<DishFormData>();
  const value = watch('primary_protein') ?? '';

  return (
    <div className="space-y-1.5">
      <Label htmlFor="primary_protein" className="text-sm font-medium">
        Primary Protein
        <span className="ml-1.5 text-xs text-muted-foreground font-normal">
          (drives feed filtering &amp; dietary tags)
        </span>
      </Label>
      <Select
        value={value ?? ''}
        onValueChange={v => setValue('primary_protein', v === '__none__' ? null : v)}
      >
        <SelectTrigger id="primary_protein" className="w-full">
          <SelectValue placeholder="Not specified" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">Not specified</SelectItem>
          {PROTEIN_GROUPS.map(group => (
            <SelectGroup key={group.label}>
              <SelectLabel>{group.label}</SelectLabel>
              {group.options.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
      {(value === 'vegetarian' || value === 'vegan') && (
        <p className="text-xs text-muted-foreground">
          Selecting {value === 'vegan' ? 'Vegan' : 'Vegetarian'} automatically sets the dietary tag
          — no need to set it separately below.
        </p>
      )}
    </div>
  );
}
