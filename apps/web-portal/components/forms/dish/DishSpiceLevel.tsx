'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { SPICE_LEVEL_CONFIG } from '@/lib/ui-constants';
import type { DishFormData } from '@/lib/validation';

export function DishSpiceLevel() {
  const { setValue, control } = useFormContext<DishFormData>();
  const spiceLevel = useWatch({ control, name: 'spice_level', defaultValue: 'none' });

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Spice Level</h3>

      <RadioGroup
        value={spiceLevel || 'none'}
        onValueChange={value =>
          setValue('spice_level', (value as 'none' | 'mild' | 'hot') || 'none')
        }
      >
        <div className="grid grid-cols-3 gap-2">
          {SPICE_LEVEL_CONFIG.map(level => (
            <div key={level.value} className="flex items-center space-x-2">
              <RadioGroupItem value={level.value} id={`spice-${level.value}`} />
              <Label
                htmlFor={`spice-${level.value}`}
                className="text-xs font-normal cursor-pointer flex flex-col items-center"
              >
                <span>{level.icon}</span>
                <span>{level.label}</span>
              </Label>
            </div>
          ))}
        </div>
      </RadioGroup>
    </div>
  );
}
