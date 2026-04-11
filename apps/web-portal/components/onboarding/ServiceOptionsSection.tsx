'use client';

import { useFormContext } from 'react-hook-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { SERVICE_SPEED_OPTIONS, PAYMENT_METHOD_OPTIONS } from '@/lib/constants';
import type { PaymentMethods } from '@/types/restaurant';
import type { BasicInfoFormData } from './types';

interface ServiceOptionsSectionProps {
  serviceSpeed: 'fast-food' | 'regular';
  onServiceSpeedChange: (value: 'fast-food' | 'regular') => void;
  paymentMethods: PaymentMethods;
  onPaymentMethodsChange: (value: PaymentMethods) => void;
}

export function ServiceOptionsSection({
  serviceSpeed,
  onServiceSpeedChange,
  paymentMethods,
  onPaymentMethodsChange,
}: ServiceOptionsSectionProps) {
  const { register, setValue } = useFormContext<BasicInfoFormData>();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Service Options</CardTitle>
        <CardDescription>What services do you offer?</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-center space-x-3">
            <Checkbox
              id="delivery_available"
              {...register('delivery_available')}
              defaultChecked={true}
            />
            <Label htmlFor="delivery_available" className="cursor-pointer">
              Delivery Available
            </Label>
          </div>
          <div className="flex items-center space-x-3">
            <Checkbox
              id="takeout_available"
              {...register('takeout_available')}
              defaultChecked={true}
            />
            <Label htmlFor="takeout_available" className="cursor-pointer">
              Takeout Available
            </Label>
          </div>
          <div className="flex items-center space-x-3">
            <Checkbox
              id="dine_in_available"
              {...register('dine_in_available')}
              defaultChecked={true}
            />
            <Label htmlFor="dine_in_available" className="cursor-pointer">
              Dine-in Available
            </Label>
          </div>
          <div className="flex items-center space-x-3">
            <Checkbox id="accepts_reservations" {...register('accepts_reservations')} />
            <Label htmlFor="accepts_reservations" className="cursor-pointer">
              Accepts Reservations
            </Label>
          </div>
        </div>

        <Separator />

        <div>
          <Label className="mb-3 block">Service Speed</Label>
          <RadioGroup
            value={serviceSpeed}
            onValueChange={value => {
              onServiceSpeedChange(value as 'fast-food' | 'regular');
              setValue('service_speed', value as 'fast-food' | 'regular');
            }}
          >
            {SERVICE_SPEED_OPTIONS.map(option => (
              <div key={option.value} className="flex items-start space-x-3 mb-3">
                <RadioGroupItem value={option.value} id={`speed-${option.value}`} />
                <div className="flex-1">
                  <Label htmlFor={`speed-${option.value}`} className="font-medium cursor-pointer">
                    {option.label}
                  </Label>
                  <p className="text-sm text-muted-foreground">{option.description}</p>
                </div>
              </div>
            ))}
          </RadioGroup>
        </div>

        <Separator />

        <div>
          <Label className="mb-3 block">Payment Methods</Label>
          <RadioGroup
            value={paymentMethods}
            onValueChange={value => {
              onPaymentMethodsChange(value as PaymentMethods);
              setValue('payment_methods', value as PaymentMethods);
            }}
          >
            {PAYMENT_METHOD_OPTIONS.map(option => (
              <div key={option.value} className="flex items-start space-x-3 mb-3">
                <RadioGroupItem value={option.value} id={`pay-${option.value}`} />
                <div className="flex-1">
                  <Label htmlFor={`pay-${option.value}`} className="font-medium cursor-pointer">
                    {option.icon} {option.label}
                  </Label>
                  <p className="text-sm text-muted-foreground">{option.description}</p>
                </div>
              </div>
            ))}
          </RadioGroup>
        </div>
      </CardContent>
    </Card>
  );
}
