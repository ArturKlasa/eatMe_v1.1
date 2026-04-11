'use client';

import { useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { BasicInfoFormData } from './types';

export function ContactFields() {
  const {
    register,
    formState: { errors },
  } = useFormContext<BasicInfoFormData>();

  return (
    <>
      <div>
        <Label htmlFor="phone" className="mb-2 block">
          Phone Number
        </Label>
        <Input id="phone" {...register('phone')} placeholder="+1 (555) 123-4567" type="tel" />
      </div>

      <div>
        <Label htmlFor="website" className="mb-2 block">
          Website
        </Label>
        <Input
          id="website"
          {...register('website', {
            validate: value => {
              if (!value || value.trim() === '') return true;
              const websitePattern =
                /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(\/.*)?$/;
              return (
                websitePattern.test(value.trim()) ||
                'Please enter a valid website (e.g., example.com)'
              );
            },
          })}
          placeholder="example.com"
          type="text"
          className={errors.website ? 'border-red-500' : ''}
        />
        {errors.website && (
          <p className="text-sm text-destructive mt-1">{errors.website.message}</p>
        )}
      </div>
    </>
  );
}
