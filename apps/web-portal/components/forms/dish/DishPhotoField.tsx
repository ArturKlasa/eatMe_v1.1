'use client';

import { useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { DishFormData } from '@/lib/validation';

export function DishPhotoField() {
  const { register } = useFormContext<DishFormData>();

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Media</h3>

      <div>
        <Label htmlFor="photo_url" className="mb-2 block">
          Photo URL (Optional)
        </Label>
        <Input
          id="photo_url"
          {...register('photo_url')}
          placeholder="https://example.com/photo.jpg"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Upload photos to a service like Imgur or use your own URL
        </p>
      </div>
    </div>
  );
}
