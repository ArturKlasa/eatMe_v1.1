'use client';

import { useFormContext } from 'react-hook-form';
import { Utensils } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RESTAURANT_TYPES } from '@eatme/shared';
import type { BasicInfoFormData } from './types';

interface BasicInfoFieldsProps {
  restaurantType: string;
  onRestaurantTypeChange: (value: string) => void;
}

export function BasicInfoFields({ restaurantType, onRestaurantTypeChange }: BasicInfoFieldsProps) {
  const {
    register,
    setValue,
    formState: { errors },
  } = useFormContext<BasicInfoFormData>();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Utensils className="h-5 w-5" />
          Basic Information
        </CardTitle>
        <CardDescription>General details about your restaurant</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="name" className="mb-2 block">
            Restaurant Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            {...register('name', { required: true })}
            placeholder="e.g., The Golden Spoon"
            className={errors.name ? 'border-red-500' : ''}
          />
        </div>

        <div>
          <Label htmlFor="description" className="mb-2 block">
            Description
          </Label>
          <Textarea
            id="description"
            {...register('description')}
            placeholder="Tell customers about your restaurant..."
            rows={3}
          />
        </div>

        <div>
          <Label htmlFor="restaurant_type" className="mb-2 block">
            Restaurant Type <span className="text-destructive">*</span>
          </Label>
          <Select
            value={restaurantType}
            onValueChange={value => {
              onRestaurantTypeChange(value);
              setValue('restaurant_type', value);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select restaurant type" />
            </SelectTrigger>
            <SelectContent>
              {RESTAURANT_TYPES.map(type => (
                <SelectItem key={type.value} value={type.value}>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{type.label}</span>
                    <span className="text-xs text-muted-foreground">- {type.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
