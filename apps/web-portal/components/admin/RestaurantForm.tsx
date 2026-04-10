'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, MapPin, Utensils, Building2, Globe, Clock } from 'lucide-react';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { CuisineSelector } from '@/components/forms/CuisineSelector';
import { OperatingHoursEditor } from '@/components/forms/OperatingHoursEditor';
import type { OperatingHoursValue } from '@/components/forms/OperatingHoursEditor';
import { RESTAURANT_TYPES, COUNTRIES, PAYMENT_METHOD_OPTIONS } from '@/lib/constants';
import type { ParsedLocationDetails } from '@/lib/parseAddress';

const LocationPicker = dynamic(() => import('@/components/LocationPicker'), {
  ssr: false,
  loading: () => <LoadingSkeleton variant="card" />,
});

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const restaurantSchema = z.object({
  name: z.string().min(1, 'Restaurant name is required'),
  restaurant_type: z.string().min(1),
  description: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  postal_code: z.string().optional(),
  country_code: z.string().min(1),
  neighbourhood: z.string().optional(),
  state: z.string().optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  delivery_available: z.boolean(),
  takeout_available: z.boolean(),
  dine_in_available: z.boolean(),
  accepts_reservations: z.boolean(),
  payment_methods: z.enum(['cash_only', 'card_only', 'cash_and_card']),
});

type RestaurantFormValues = z.infer<typeof restaurantSchema>;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface RestaurantFormData {
  name: string;
  restaurant_type: string;
  description?: string;
  phone?: string;
  website?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  country_code: string;
  neighbourhood?: string;
  state?: string;
  latitude?: string;
  longitude?: string;
  delivery_available: boolean;
  takeout_available: boolean;
  dine_in_available: boolean;
  accepts_reservations: boolean;
  payment_methods: 'cash_only' | 'card_only' | 'cash_and_card';
  cuisine_types: string[];
  operating_hours: Record<string, OperatingHoursValue>;
}

export interface RestaurantFormProps {
  mode: 'create' | 'edit';
  initialData?: Partial<RestaurantFormData>;
  onSubmit: (data: RestaurantFormData) => Promise<void>;
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// Helpers for page wrappers
// ---------------------------------------------------------------------------

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

/** Convert a Supabase restaurant row into RestaurantFormData for the form. */
export function convertDbToFormData(
  data: Record<string, unknown>
): Partial<RestaurantFormData> {
  const operating_hours: Record<string, OperatingHoursValue> = {};
  DAYS.forEach(day => {
    const saved = (
      data.open_hours as Record<string, { open: string; close: string }> | null
    )?.[day];
    operating_hours[day] = saved
      ? { open: saved.open, close: saved.close, closed: false }
      : { open: '09:00', close: '21:00', closed: true };
  });

  const location = data.location as { lat?: number; lng?: number } | null;

  return {
    name: (data.name as string) || '',
    address: (data.address as string) || '',
    city: (data.city as string) || '',
    neighbourhood: (data.neighbourhood as string) || '',
    state: (data.state as string) || '',
    postal_code: (data.postal_code as string) || '',
    country_code: (data.country_code as string) || 'US',
    phone: (data.phone as string) || '',
    website: (data.website as string) || '',
    description: (data.description as string) || '',
    restaurant_type: (data.restaurant_type as string) || 'restaurant',
    cuisine_types: (data.cuisine_types as string[]) || [],
    latitude: location?.lat?.toString() || '',
    longitude: location?.lng?.toString() || '',
    delivery_available: (data.delivery_available as boolean) || false,
    takeout_available: (data.takeout_available as boolean) || false,
    dine_in_available: (data.dine_in_available as boolean) !== false,
    accepts_reservations: (data.accepts_reservations as boolean) || false,
    payment_methods:
      (data.payment_methods as 'cash_only' | 'card_only' | 'cash_and_card') || 'cash_and_card',
    operating_hours,
  };
}

/** Convert RestaurantFormData into the column shape expected by Supabase. */
export function formDataToDbColumns(data: RestaurantFormData) {
  const lat = parseFloat(data.latitude ?? '');
  const lng = parseFloat(data.longitude ?? '');

  const open_hours: Record<string, { open: string; close: string }> = {};
  Object.entries(data.operating_hours).forEach(([day, hours]) => {
    if (!hours.closed) {
      open_hours[day] = { open: hours.open, close: hours.close };
    }
  });

  return {
    name: data.name,
    address: data.address || '',
    city: data.city || null,
    neighbourhood: data.neighbourhood || null,
    state: data.state || null,
    postal_code: data.postal_code || null,
    country_code: data.country_code,
    phone: data.phone || null,
    website: data.website || null,
    description: data.description || null,
    restaurant_type: data.restaurant_type,
    cuisine_types: data.cuisine_types,
    location: { lat, lng },
    open_hours,
    delivery_available: data.delivery_available,
    takeout_available: data.takeout_available,
    dine_in_available: data.dine_in_available,
    accepts_reservations: data.accepts_reservations,
    payment_methods: data.payment_methods,
  };
}

// ---------------------------------------------------------------------------
// Default operating hours
// ---------------------------------------------------------------------------

const DEFAULT_HOURS: Record<string, OperatingHoursValue> = {
  monday: { open: '09:00', close: '21:00', closed: false },
  tuesday: { open: '09:00', close: '21:00', closed: false },
  wednesday: { open: '09:00', close: '21:00', closed: false },
  thursday: { open: '09:00', close: '21:00', closed: false },
  friday: { open: '09:00', close: '22:00', closed: false },
  saturday: { open: '09:00', close: '22:00', closed: false },
  sunday: { open: '10:00', close: '20:00', closed: false },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RestaurantForm({ mode, initialData, onSubmit, onCancel }: RestaurantFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [cuisines, setCuisines] = useState<string[]>(initialData?.cuisine_types ?? []);
  const [operatingHours, setOperatingHours] = useState<Record<string, OperatingHoursValue>>(
    initialData?.operating_hours ?? DEFAULT_HOURS
  );

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RestaurantFormValues>({
    resolver: zodResolver(restaurantSchema),
    defaultValues: {
      name: initialData?.name ?? '',
      restaurant_type: initialData?.restaurant_type ?? 'restaurant',
      description: initialData?.description ?? '',
      phone: initialData?.phone ?? '',
      website: initialData?.website ?? '',
      address: initialData?.address ?? '',
      city: initialData?.city ?? '',
      postal_code: initialData?.postal_code ?? '',
      country_code: initialData?.country_code ?? 'US',
      neighbourhood: initialData?.neighbourhood ?? '',
      state: initialData?.state ?? '',
      latitude: initialData?.latitude ?? '',
      longitude: initialData?.longitude ?? '',
      delivery_available: initialData?.delivery_available ?? true,
      takeout_available: initialData?.takeout_available ?? true,
      dine_in_available: initialData?.dine_in_available ?? true,
      accepts_reservations: initialData?.accepts_reservations ?? false,
      payment_methods: initialData?.payment_methods ?? 'cash_and_card',
    },
  });

  const deliveryAvailable = watch('delivery_available');
  const takeoutAvailable = watch('takeout_available');
  const dineInAvailable = watch('dine_in_available');
  const acceptsReservations = watch('accepts_reservations');
  const paymentMethods = watch('payment_methods');
  const latitude = watch('latitude');
  const longitude = watch('longitude');

  const handleLocationSelect = (lat: number, lng: number) => {
    setValue('latitude', lat.toString());
    setValue('longitude', lng.toString());
    toast.success('Location marked on map!');
  };

  const handleAddressSelect = (address: string) => {
    setValue('address', address);
    toast.success('Address auto-filled from map location!');
  };

  const handleLocationDetails = (details: ParsedLocationDetails) => {
    const supportedCountry = COUNTRIES.find(c => c.value === details.countryCode);
    if (details.city) setValue('city', details.city);
    if (details.neighbourhood) setValue('neighbourhood', details.neighbourhood);
    if (details.state) setValue('state', details.state);
    if (details.postalCode) setValue('postal_code', details.postalCode);
    if (supportedCountry) setValue('country_code', details.countryCode);
  };

  const onFormSubmit = async (values: RestaurantFormValues) => {
    setSubmitting(true);
    try {
      await onSubmit({
        ...values,
        cuisine_types: cuisines,
        operating_hours: operatingHours,
      });
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Utensils className="h-5 w-5 text-orange-600" />
            Basic Information
          </CardTitle>
          <CardDescription>General details about the restaurant</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rf-name">
              Restaurant Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="rf-name"
              {...register('name')}
              placeholder="e.g., The Golden Spoon"
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="rf-type">
              Restaurant Type <span className="text-red-500">*</span>
            </Label>
            <Select
              value={watch('restaurant_type')}
              onValueChange={v => setValue('restaurant_type', v)}
            >
              <SelectTrigger id="rf-type">
                <SelectValue placeholder="Select restaurant type" />
              </SelectTrigger>
              <SelectContent>
                {RESTAURANT_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{type.label}</span>
                      <span className="text-xs text-muted-foreground">
                        - {type.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rf-description">Description</Label>
            <Textarea
              id="rf-description"
              {...register('description')}
              placeholder="Share what makes this restaurant special..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Cuisines */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-orange-600" />
            Cuisine Types <span className="text-red-500">*</span>
          </CardTitle>
          <CardDescription>Select all cuisines that apply to this restaurant</CardDescription>
        </CardHeader>
        <CardContent>
          <CuisineSelector selected={cuisines} onChange={setCuisines} />
        </CardContent>
      </Card>

      {/* Location */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-orange-600" />
            Location
          </CardTitle>
          <CardDescription>Where can customers find this restaurant?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-2 text-sm text-gray-600 bg-blue-50 p-3 rounded-md">
            <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-blue-600" />
            <p>
              Click anywhere on the map to pin the restaurant. Country, city, postal code and
              address will be auto-filled — you can still edit them manually.
            </p>
          </div>

          <LocationPicker
            initialLat={latitude ? parseFloat(latitude) : undefined}
            initialLng={longitude ? parseFloat(longitude) : undefined}
            onLocationSelect={handleLocationSelect}
            onAddressSelect={handleAddressSelect}
            onLocationDetails={handleLocationDetails}
          />

          <div className="space-y-2">
            <Label htmlFor="rf-country">
              Country <span className="text-red-500">*</span>
            </Label>
            <Select
              value={watch('country_code')}
              onValueChange={v => setValue('country_code', v)}
            >
              <SelectTrigger id="rf-country">
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map(c => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rf-city">City</Label>
              <Input
                id="rf-city"
                {...register('city')}
                placeholder="San Francisco"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rf-postal">Postal Code</Label>
              <Input
                id="rf-postal"
                {...register('postal_code')}
                placeholder="94102"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rf-neighbourhood">
                Neighbourhood{' '}
                <span className="text-gray-400 font-normal text-xs">(optional)</span>
              </Label>
              <Input
                id="rf-neighbourhood"
                {...register('neighbourhood')}
                placeholder="Downtown"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rf-state">State / Province</Label>
              <Input
                id="rf-state"
                {...register('state')}
                placeholder="California"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rf-address">
              Full Address <span className="text-red-500">*</span>
            </Label>
            <Input
              id="rf-address"
              {...register('address')}
              placeholder="123 Main Street, City, State, ZIP"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rf-lat">Latitude</Label>
              <Input
                id="rf-lat"
                {...register('latitude')}
                readOnly
                placeholder="Click map to set"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rf-lng">Longitude</Label>
              <Input
                id="rf-lng"
                {...register('longitude')}
                readOnly
                placeholder="Click map to set"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-orange-600" />
            Contact Information
          </CardTitle>
          <CardDescription>How can customers reach this restaurant?</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rf-phone">Phone Number</Label>
              <Input
                id="rf-phone"
                type="tel"
                {...register('phone')}
                placeholder="+1 (555) 123-4567"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rf-website">Website</Label>
              <Input
                id="rf-website"
                {...register('website')}
                placeholder="https://yourrestaurant.com"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Service Options */}
      <Card>
        <CardHeader>
          <CardTitle>Service Options</CardTitle>
          <CardDescription>What services does this restaurant offer?</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="rf-delivery"
                checked={deliveryAvailable}
                onCheckedChange={checked => setValue('delivery_available', !!checked)}
              />
              <Label htmlFor="rf-delivery" className="cursor-pointer">
                Delivery Available
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="rf-takeout"
                checked={takeoutAvailable}
                onCheckedChange={checked => setValue('takeout_available', !!checked)}
              />
              <Label htmlFor="rf-takeout" className="cursor-pointer">
                Takeout Available
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="rf-dinein"
                checked={dineInAvailable}
                onCheckedChange={checked => setValue('dine_in_available', !!checked)}
              />
              <Label htmlFor="rf-dinein" className="cursor-pointer">
                Dine-in Available
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="rf-reservations"
                checked={acceptsReservations}
                onCheckedChange={checked => setValue('accepts_reservations', !!checked)}
              />
              <Label htmlFor="rf-reservations" className="cursor-pointer">
                Accepts Reservations
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Methods */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Methods</CardTitle>
          <CardDescription>What payment methods are accepted?</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={paymentMethods}
            onValueChange={value =>
              setValue('payment_methods', value as 'cash_only' | 'card_only' | 'cash_and_card')
            }
            className="grid grid-cols-1 gap-2"
          >
            {PAYMENT_METHOD_OPTIONS.map(option => (
              <div key={option.value} className="flex items-start space-x-3">
                <RadioGroupItem
                  value={option.value}
                  id={`rf-pay-${option.value}`}
                  className="mt-0.5"
                />
                <div>
                  <Label htmlFor={`rf-pay-${option.value}`} className="font-medium cursor-pointer">
                    {option.icon} {option.label}
                  </Label>
                  <p className="text-xs text-gray-500">{option.description}</p>
                </div>
              </div>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Operating Hours */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-orange-600" />
            Operating Hours
          </CardTitle>
          <CardDescription>When is the restaurant open for business?</CardDescription>
        </CardHeader>
        <CardContent>
          <OperatingHoursEditor value={operatingHours} onChange={setOperatingHours} />
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-4 pt-4">
        <Button
          type="submit"
          disabled={submitting}
          size="lg"
          className="bg-orange-600 hover:bg-orange-700"
        >
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {mode === 'create' ? 'Create Restaurant' : 'Save Changes'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
