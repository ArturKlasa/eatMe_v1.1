'use client';

import { useState, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, MapPin, Utensils, Building2, Globe, Clock } from 'lucide-react';
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
import { CuisineSelector } from '@/components/forms/CuisineSelector';
import { OperatingHoursEditor } from '@/components/forms/OperatingHoursEditor';
import type { OperatingHoursValue } from '@/components/forms/OperatingHoursEditor';
import { LocationFormSection } from '@/components/LocationFormSection';
import { SectionCard } from '@/components/SectionCard';
import { InfoBox } from '@/components/InfoBox';
import { RESTAURANT_TYPES, PAYMENT_METHOD_OPTIONS } from '@eatme/shared';
import { useAuth } from '@/contexts/AuthContext';
import { useRestaurantDraft } from '@/lib/hooks/useRestaurantDraft';
import type { BasicInfoFormData } from '@/components/onboarding/types';
import type { UseFormWatch } from 'react-hook-form';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const locationSchema = z.object({
  country: z.string().min(1),
  address: z.string(),
  city: z.string(),
  neighborhood: z.string(),
  state: z.string(),
  postalCode: z.string(),
  lat: z.number(),
  lng: z.number(),
});

const restaurantSchema = z.object({
  name: z.string().min(1, 'Restaurant name is required'),
  restaurant_type: z.string().min(1),
  description: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  location: locationSchema,
  delivery_available: z.boolean(),
  takeout_available: z.boolean(),
  dine_in_available: z.boolean(),
  accepts_reservations: z.boolean(),
  payment_methods: z.enum(['cash_only', 'card_only', 'cash_and_card']),
  service_speed: z.enum(['fast-food', 'regular']).optional(),
});

type RestaurantFormValues = z.infer<typeof restaurantSchema>;

// ---------------------------------------------------------------------------
// Sections config
// ---------------------------------------------------------------------------

export interface RestaurantFormSection {
  basicInfo?: boolean;
  contact?: boolean;
  location?: boolean;
  cuisines?: boolean;
  operatingHours?: boolean;
  serviceOptions?: boolean;
}

export const ADMIN_FULL_SECTIONS: RestaurantFormSection = {
  basicInfo: true,
  contact: true,
  location: true,
  cuisines: true,
  operatingHours: true,
  serviceOptions: true,
};

export const ADMIN_COMPACT_SECTIONS: RestaurantFormSection = {
  basicInfo: true,
  location: true,
  cuisines: true,
};

export const OWNER_EDIT_SECTIONS: RestaurantFormSection = {
  basicInfo: true,
  contact: true,
  location: true,
  cuisines: true,
  operatingHours: true,
  serviceOptions: true,
};

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
  variant?: 'full' | 'compact';
  sections?: RestaurantFormSection;
  initialData?: Partial<RestaurantFormData>;
  enableDraft?: boolean;
  /** Canonical callback — called with form data on successful submit. */
  onSuccess?: (data: RestaurantFormData) => Promise<void>;
  /** Backward-compat alias for onSuccess. */
  onSubmit?: (data: RestaurantFormData) => Promise<void>;
  onCancel?: () => void;
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
// Section wrapper helper
// ---------------------------------------------------------------------------

function Section({
  compact,
  title,
  description,
  icon,
  children,
  defaultExpanded = true,
}: {
  compact: boolean;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}) {
  if (compact) {
    return (
      <SectionCard
        title={title}
        icon={icon}
        description={description}
        collapsible
        defaultExpanded={defaultExpanded}
      >
        {children}
      </SectionCard>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RestaurantForm({
  mode,
  variant = 'full',
  sections = ADMIN_FULL_SECTIONS,
  initialData,
  enableDraft = false,
  onSuccess,
  onSubmit: onSubmitProp,
  onCancel,
}: RestaurantFormProps) {
  const compact = variant === 'compact';

  const [submitting, setSubmitting] = useState(false);
  const [cuisines, setCuisines] = useState<string[]>(initialData?.cuisine_types ?? []);
  const [operatingHours, setOperatingHours] = useState<Record<string, OperatingHoursValue>>(
    initialData?.operating_hours ?? DEFAULT_HOURS
  );

  // Track if cuisines changed from initial (for edit mode cascade warning)
  const initialCuisines = initialData?.cuisine_types ?? [];
  const cuisinesChanged =
    mode === 'edit' &&
    (cuisines.length !== initialCuisines.length ||
      cuisines.some(c => !initialCuisines.includes(c)));

  // Refs for draft hook
  const cuisinesRef = useRef<string[]>(cuisines);
  cuisinesRef.current = cuisines;
  const operatingHoursRef = useRef<Record<string, OperatingHoursValue>>(operatingHours);
  operatingHoursRef.current = operatingHours;

  const {
    register,
    handleSubmit,
    control,
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
      location: {
        country: initialData?.country_code ?? 'US',
        address: initialData?.address ?? '',
        city: initialData?.city ?? '',
        neighborhood: initialData?.neighbourhood ?? '',
        state: initialData?.state ?? '',
        postalCode: initialData?.postal_code ?? '',
        lat: parseFloat(initialData?.latitude ?? '') || 0,
        lng: parseFloat(initialData?.longitude ?? '') || 0,
      },
      delivery_available: initialData?.delivery_available ?? true,
      takeout_available: initialData?.takeout_available ?? true,
      dine_in_available: initialData?.dine_in_available ?? true,
      accepts_reservations: initialData?.accepts_reservations ?? false,
      payment_methods: initialData?.payment_methods ?? 'cash_and_card',
      service_speed: 'regular',
    },
  });

  // Draft auto-save — only active when enableDraft=true
  const { user } = useAuth();
  useRestaurantDraft({
    userId: enableDraft ? user?.id : undefined,
    watch: watch as unknown as UseFormWatch<BasicInfoFormData>,
    selectedCuisinesRef: cuisinesRef as React.RefObject<string[]>,
    operatingHoursRef: operatingHoursRef as React.RefObject<
      Record<string, { open: string; close: string; closed: boolean }>
    >,
  });

  const deliveryAvailable = watch('delivery_available');
  const takeoutAvailable = watch('takeout_available');
  const dineInAvailable = watch('dine_in_available');
  const acceptsReservations = watch('accepts_reservations');
  const paymentMethods = watch('payment_methods');

  const submitHandler = onSuccess ?? onSubmitProp;

  const onFormSubmit = async (values: RestaurantFormValues) => {
    if (!submitHandler) return;
    setSubmitting(true);
    try {
      await submitHandler({
        name: values.name,
        restaurant_type: values.restaurant_type,
        description: values.description,
        phone: values.phone,
        website: values.website,
        address: values.location.address,
        city: values.location.city,
        postal_code: values.location.postalCode,
        country_code: values.location.country,
        neighbourhood: values.location.neighborhood,
        state: values.location.state,
        latitude: values.location.lat ? values.location.lat.toString() : '',
        longitude: values.location.lng ? values.location.lng.toString() : '',
        delivery_available: values.delivery_available,
        takeout_available: values.takeout_available,
        dine_in_available: values.dine_in_available,
        accepts_reservations: values.accepts_reservations,
        payment_methods: values.payment_methods,
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
      {sections.basicInfo === true && (
        <Section
          compact={compact}
          title="Basic Information"
          description="General details about the restaurant"
          icon={<Utensils className="h-5 w-5 text-brand-primary" />}
        >
          <div className="space-y-2">
            <Label htmlFor="rf-name">
              Restaurant Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="rf-name"
              {...register('name')}
              placeholder="e.g., The Golden Spoon"
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="rf-type">
              Restaurant Type <span className="text-destructive">*</span>
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
        </Section>
      )}

      {/* Cuisines */}
      {sections.cuisines === true && (
        <Section
          compact={compact}
          title="Cuisine Types"
          description="Select all cuisines that apply to this restaurant"
          icon={<Building2 className="h-5 w-5 text-brand-primary" />}
          defaultExpanded={!compact}
        >
          <CuisineSelector selected={cuisines} onChange={setCuisines} />
          {cuisinesChanged && (
            <InfoBox variant="warning" className="mt-3">
              Changing cuisines will not remove existing dishes, but some category assignments may
              no longer apply. Review your menu after saving.
            </InfoBox>
          )}
        </Section>
      )}

      {/* Location */}
      {sections.location === true && (
        <Section
          compact={compact}
          title="Location"
          description="Where can customers find this restaurant?"
          icon={<MapPin className="h-5 w-5 text-brand-primary" />}
        >
          <Controller
            name="location"
            control={control}
            render={({ field }) => (
              <LocationFormSection value={field.value} onChange={field.onChange} />
            )}
          />
        </Section>
      )}

      {/* Contact */}
      {sections.contact === true && (
        <Section
          compact={compact}
          title="Contact Information"
          description="How can customers reach this restaurant?"
          icon={<Globe className="h-5 w-5 text-brand-primary" />}
          defaultExpanded={!compact}
        >
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
        </Section>
      )}

      {/* Service Options */}
      {sections.serviceOptions === true && (
        <Section
          compact={compact}
          title="Service Options"
          description="What services does this restaurant offer?"
          defaultExpanded={!compact}
        >
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
        </Section>
      )}

      {/* Payment Methods */}
      {sections.serviceOptions === true && (
        <Section
          compact={compact}
          title="Payment Methods"
          description="What payment methods are accepted?"
          defaultExpanded={!compact}
        >
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
                  <Label
                    htmlFor={`rf-pay-${option.value}`}
                    className="font-medium cursor-pointer"
                  >
                    {option.icon} {option.label}
                  </Label>
                  <p className="text-xs text-muted-foreground">{option.description}</p>
                </div>
              </div>
            ))}
          </RadioGroup>
        </Section>
      )}

      {/* Operating Hours */}
      {sections.operatingHours === true && (
        <Section
          compact={compact}
          title="Operating Hours"
          description="When is the restaurant open for business?"
          icon={<Clock className="h-5 w-5 text-brand-primary" />}
          defaultExpanded={!compact}
        >
          <OperatingHoursEditor value={operatingHours} onChange={setOperatingHours} />
        </Section>
      )}

      {/* Actions */}
      <div className="flex gap-4 pt-4">
        <Button
          type="submit"
          disabled={submitting}
          size={compact ? 'sm' : 'lg'}
          className="bg-brand-primary hover:bg-brand-primary/90"
        >
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {mode === 'create' ? 'Create Restaurant' : 'Save Changes'}
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            size={compact ? 'sm' : 'default'}
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
