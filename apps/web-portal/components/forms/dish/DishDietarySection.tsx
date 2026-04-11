'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Sprout, Leaf } from 'lucide-react';
import { DIETARY_TAGS, ALLERGENS, RELIGIOUS_REQUIREMENTS } from '@eatme/shared';
import type { DishFormData } from '@eatme/shared';

export function DishDietarySection() {
  const { setValue, control } = useFormContext<DishFormData>();
  const dietaryTags = useWatch({ control, name: 'dietary_tags', defaultValue: [] }) || [];
  const allergens = useWatch({ control, name: 'allergens', defaultValue: [] }) || [];

  const toggleDietaryTag = (tag: string) => {
    const current = dietaryTags;

    if (tag === 'vegan') {
      if (current.includes('vegan')) {
        setValue(
          'dietary_tags',
          current.filter((t: string) => t !== 'vegan')
        );
      } else {
        const newTags = [...current, 'vegan'];
        if (!newTags.includes('vegetarian')) {
          newTags.push('vegetarian');
        }
        setValue('dietary_tags', newTags);
      }
    } else if (tag === 'vegetarian') {
      if (current.includes('vegetarian')) {
        if (!current.includes('vegan')) {
          setValue(
            'dietary_tags',
            current.filter((t: string) => t !== 'vegetarian')
          );
        }
      } else {
        setValue('dietary_tags', [...current, 'vegetarian']);
      }
    } else {
      if (current.includes(tag)) {
        setValue(
          'dietary_tags',
          current.filter((t: string) => t !== tag)
        );
      } else {
        setValue('dietary_tags', [...current, tag]);
      }
    }
  };

  const toggleAllergen = (allergen: string) => {
    const current = allergens;
    if (current.includes(allergen)) {
      setValue(
        'allergens',
        current.filter((a: string) => a !== allergen)
      );
    } else {
      setValue('allergens', [...current, allergen]);
    }
  };

  return (
    <>
      {/* Vegetarian/Vegan Section */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Vegetarian/Vegan</h3>

        <div className="flex gap-6">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="vegetarian"
              checked={dietaryTags.includes('vegetarian')}
              onCheckedChange={() => toggleDietaryTag('vegetarian')}
            />
            <Label htmlFor="vegetarian" className="text-sm font-normal cursor-pointer">
              <Sprout className="h-3.5 w-3.5 inline-block mr-0.5" />Vegetarian
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="vegan"
              checked={dietaryTags.includes('vegan')}
              onCheckedChange={() => toggleDietaryTag('vegan')}
            />
            <Label htmlFor="vegan" className="text-sm font-normal cursor-pointer">
              <Leaf className="h-3.5 w-3.5 inline-block mr-0.5" />Vegan
            </Label>
          </div>
        </div>
      </div>

      {/* Allergens Section */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Allergens</h3>

        <div>
          <p className="text-xs text-muted-foreground mb-2">Mark allergens present in this dish</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {ALLERGENS.map(allergen => (
              <div key={allergen.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`allergen-${allergen.value}`}
                  checked={allergens.includes(allergen.value)}
                  onCheckedChange={() => toggleAllergen(allergen.value)}
                />
                <Label
                  htmlFor={`allergen-${allergen.value}`}
                  className="text-sm font-normal cursor-pointer"
                >
                  {allergen.label}
                </Label>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Dietary Tags Section */}
      <div className="space-y-4">
        <div>
          <Label className="mb-2 block">Dietary Tags</Label>
          <p className="text-xs text-muted-foreground mb-2">Select all that apply</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {DIETARY_TAGS.filter(
              tag =>
                tag.value !== 'vegetarian' &&
                tag.value !== 'vegan' &&
                !(RELIGIOUS_REQUIREMENTS as readonly string[]).includes(tag.value)
            ).map(tag => (
              <div key={tag.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`dietary-${tag.value}`}
                  checked={dietaryTags.includes(tag.value)}
                  onCheckedChange={() => toggleDietaryTag(tag.value)}
                />
                <Label
                  htmlFor={`dietary-${tag.value}`}
                  className="text-sm font-normal cursor-pointer"
                >
                  {tag.label}
                </Label>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Religious Requirements Section */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Religious Requirements</h3>

        <div>
          <p className="text-xs text-muted-foreground mb-2">Select all that apply</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {RELIGIOUS_REQUIREMENTS.map(tag => (
              <div key={tag} className="flex items-center space-x-2">
                <Checkbox
                  id={`religious-${tag}`}
                  checked={dietaryTags.includes(tag)}
                  onCheckedChange={() => toggleDietaryTag(tag)}
                />
                <Label
                  htmlFor={`religious-${tag}`}
                  className="text-sm font-normal cursor-pointer capitalize"
                >
                  {tag}
                </Label>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
