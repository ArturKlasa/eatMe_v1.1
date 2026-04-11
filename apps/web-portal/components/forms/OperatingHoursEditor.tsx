'use client';

import { useState } from 'react';
import { DAYS_OF_WEEK } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';

export interface OperatingHoursValue {
  open: string;
  close: string;
  closed: boolean;
}

export interface OperatingHoursEditorProps {
  value: Record<string, OperatingHoursValue>;
  onChange: (hours: Record<string, OperatingHoursValue>) => void;
}

export function OperatingHoursEditor({ value, onChange }: OperatingHoursEditorProps) {
  const [quickHours, setQuickHours] = useState({ open: '09:00', close: '21:00' });

  const handleDayClosedToggle = (day: string) => {
    onChange({
      ...value,
      [day]: { ...value[day], closed: !value[day]?.closed },
    });
  };

  const handleHoursChange = (day: string, field: 'open' | 'close', val: string) => {
    onChange({
      ...value,
      [day]: { ...value[day], [field]: val },
    });
  };

  const applyQuickHours = (days: string[]) => {
    const next = { ...value };
    days.forEach(day => {
      next[day] = { open: quickHours.open, close: quickHours.close, closed: false };
    });
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {/* Quick-fill strip */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-brand-primary/5 border border-brand-primary/10 rounded-lg">
        <span className="text-sm font-medium text-foreground shrink-0">Apply to:</span>
        <Input
          type="time"
          aria-label="Quick-fill opening time"
          value={quickHours.open}
          onChange={e => setQuickHours(q => ({ ...q, open: e.target.value }))}
          className="w-32"
        />
        <span className="text-sm text-muted-foreground">to</span>
        <Input
          type="time"
          aria-label="Quick-fill closing time"
          value={quickHours.close}
          onChange={e => setQuickHours(q => ({ ...q, close: e.target.value }))}
          className="w-32"
        />
        <div className="flex gap-2 flex-wrap">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => applyQuickHours(DAYS_OF_WEEK.map(d => d.key))}
          >
            All days
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              applyQuickHours(['monday', 'tuesday', 'wednesday', 'thursday', 'friday'])
            }
          >
            Weekdays
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => applyQuickHours(['saturday', 'sunday'])}
          >
            Weekends
          </Button>
        </div>
      </div>
      <Separator />
      {DAYS_OF_WEEK.map(({ key, label }) => (
        <div key={key}>
          <div className="flex items-center gap-4">
            <div className="w-28 shrink-0">
              <Label className="text-sm font-medium">{label}</Label>
            </div>
            <div className="flex items-center gap-3 flex-1 flex-wrap">
              <Checkbox
                id={`closed-${key}`}
                checked={value[key]?.closed || false}
                onCheckedChange={() => handleDayClosedToggle(key)}
              />
              <Label
                htmlFor={`closed-${key}`}
                className="text-sm text-muted-foreground cursor-pointer"
              >
                Closed
              </Label>
              {!value[key]?.closed && (
                <>
                  <Input
                    type="time"
                    aria-label={`Opening time for ${label}`}
                    value={value[key]?.open || '09:00'}
                    onChange={e => handleHoursChange(key, 'open', e.target.value)}
                    className="w-32"
                  />
                  <span className="text-muted-foreground text-sm">to</span>
                  <Input
                    type="time"
                    aria-label={`Closing time for ${label}`}
                    value={value[key]?.close || '17:00'}
                    onChange={e => handleHoursChange(key, 'close', e.target.value)}
                    className="w-32"
                  />
                </>
              )}
            </div>
          </div>
          {key !== 'sunday' && <Separator className="mt-3" />}
        </div>
      ))}
    </div>
  );
}
