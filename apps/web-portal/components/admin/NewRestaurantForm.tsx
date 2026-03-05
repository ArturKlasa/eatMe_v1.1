'use client';

/**
 * NewRestaurantForm — shared component used in:
 *  - app/admin/restaurants/new/page.tsx  (full-page, compact=false)
 *  - app/admin/menu-scan/page.tsx        (inline quick-add, compact=true)
 *
 * In compact mode sections are collapsible so the panel stays manageable
 * while AI is processing. All sections collapsed by default except
 * Basic Info and Location.
 */

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { Loader2, MapPin, Clock, X, Utensils, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase, formatLocationForSupabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CUISINES, RESTAURANT_TYPES, COUNTRIES, POPULAR_CUISINES } from '@/lib/constants';
import type { ParsedLocationDetails } from '@/lib/parseAddress';
import { cn } from '@/lib/utils';

const LocationPickerDynamic = dynamic(() => import('@/components/LocationPicker'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-48 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
      <p className="text-gray-500 text-sm">Loading map…</p>
    </div>
  ),
});

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Mon' },
  { key: 'tuesday', label: 'Tue' },
  { key: 'wednesday', label: 'Wed' },
  { key: 'thursday', label: 'Thu' },
  { key: 'friday', label: 'Fri' },
  { key: 'saturday', label: 'Sat' },
  { key: 'sunday', label: 'Sun' },
];

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface NewRestaurantResult {
  id: string;
  name: string;
  city: string | null;
  country_code: string | null;
}

export interface NewRestaurantFormProps {
  initialName?: string;
  /** Called after the restaurant is successfully inserted. */
  onSave: (restaurant: NewRestaurantResult) => void;
  /** Called when the user cancels (only shown when compact=true). */
  onCancel?: () => void;
  /**
   * When true renders without full-page Card wrappers with collapsible
   * sections so it fits inside a side-panel or inline form area.
   */
  compact?: boolean;
}

// ---------------------------------------------------------------------------
// Section wrapper helpers
// ---------------------------------------------------------------------------

function SectionCard({
  compact,
  title,
  description,
  icon,
  children,
  collapsible,
  defaultOpen = true,
}: {
  compact: boolean;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  if (!compact) {
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

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      <button
        type="button"
        onClick={() => collapsible && setOpen(v => !v)}
        className={cn(
          'w-full flex items-center justify-between px-4 py-3 text-left',
          collapsible ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default',
          'bg-gray-50/80 border-b border-gray-100'
        )}
      >
        <span className="flex items-center gap-2 font-semibold text-sm text-gray-800">
          {icon}
          {title}
        </span>
        {collapsible &&
          (open ? (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-400" />
          ))}
      </button>
      {open && <div className="p-4 space-y-3">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function NewRestaurantForm({
  initialName = '',
  onSave,
  onCancel,
  compact = false,
}: NewRestaurantFormProps) {
  const [saving, setSaving] = useState(false);
  const [cuisineSearch, setCuisineSearch] = useState('');
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([]);
  const [mapCoordinates, setMapCoordinates] = useState<{ lat: number; lng: number } | null>(null);

  const [formData, setFormData] = useState({
    name: initialName,
    address: '',
    city: '',
    neighbourhood: '',
    state: '',
    postal_code: '',
    country_code: 'MX',
    phone: '',
    website: '',
    restaurant_type: 'restaurant',
    latitude: '',
    longitude: '',
    delivery_available: true,
    takeout_available: true,
    dine_in_available: true,
    accepts_reservations: false,
    service_speed: 'regular' as 'fast-food' | 'regular',
  });

  const [operatingHours, setOperatingHours] = useState<
    Record<string, { open: string; close: string; closed: boolean }>
  >({
    monday: { open: '09:00', close: '21:00', closed: false },
    tuesday: { open: '09:00', close: '21:00', closed: false },
    wednesday: { open: '09:00', close: '21:00', closed: false },
    thursday: { open: '09:00', close: '21:00', closed: false },
    friday: { open: '09:00', close: '22:00', closed: false },
    saturday: { open: '09:00', close: '22:00', closed: false },
    sunday: { open: '10:00', close: '20:00', closed: false },
  });

  const [quickHours, setQuickHours] = useState({ open: '09:00', close: '21:00' });

  // ---- handlers ----

  const set = (patch: Partial<typeof formData>) => setFormData(prev => ({ ...prev, ...patch }));

  const handleCuisineToggle = (c: string) =>
    setSelectedCuisines(prev => (prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]));

  const handleDayClosedToggle = (day: string) =>
    setOperatingHours(prev => ({
      ...prev,
      [day]: { ...prev[day], closed: !prev[day].closed },
    }));

  const handleHoursChange = (day: string, field: 'open' | 'close', value: string) =>
    setOperatingHours(prev => ({ ...prev, [day]: { ...prev[day], [field]: value } }));

  const applyQuickHours = (days: string[]) =>
    setOperatingHours(prev => {
      const next = { ...prev };
      days.forEach(d => {
        next[d] = { open: quickHours.open, close: quickHours.close, closed: false };
      });
      return next;
    });

  const handleLocationSelect = (lat: number, lng: number) => {
    set({ latitude: lat.toString(), longitude: lng.toString() });
    setMapCoordinates({ lat, lng });
    toast.success('Location marked on map!');
  };

  const handleAddressSelect = (address: string) => {
    set({ address });
    toast.success('Address auto-filled from map!');
  };

  const handleLocationDetails = (details: ParsedLocationDetails) => {
    const supportedCountry = COUNTRIES.find(c => c.value === details.countryCode);
    set({
      city: details.city || formData.city,
      neighbourhood: details.neighbourhood || formData.neighbourhood,
      state: details.state || formData.state,
      postal_code: details.postalCode || formData.postal_code,
      country_code: supportedCountry ? details.countryCode : formData.country_code,
    });
    toast.success('Location details auto-filled!');
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Restaurant name is required');
      return;
    }

    setSaving(true);
    try {
      const lat = parseFloat(formData.latitude);
      const lng = parseFloat(formData.longitude);

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast.error('Not authenticated');
        return;
      }

      const open_hours: Record<string, { open: string; close: string }> = {};
      Object.entries(operatingHours).forEach(([day, hours]) => {
        if (!hours.closed) open_hours[day] = { open: hours.open, close: hours.close };
      });

      const insertData: Record<string, unknown> = {
        name: formData.name.trim(),
        address: formData.address || null,
        city: formData.city || null,
        neighbourhood: formData.neighbourhood || null,
        state: formData.state || null,
        postal_code: formData.postal_code || null,
        country_code: formData.country_code || null,
        phone: formData.phone || null,
        website: formData.website || null,
        restaurant_type: formData.restaurant_type,
        cuisine_types: selectedCuisines,
        open_hours,
        delivery_available: formData.delivery_available,
        takeout_available: formData.takeout_available,
        dine_in_available: formData.dine_in_available,
        accepts_reservations: formData.accepts_reservations,
        service_speed: formData.service_speed,
        owner_id: userData.user.id,
        is_active: true,
      };

      if (!isNaN(lat) && !isNaN(lng)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (insertData as any).location = { lat, lng };
      }

      const { data: created, error } = await supabase
        .from('restaurants')
        .insert(insertData as any)
        .select('id, name, city, country_code')
        .single();

      if (error) throw error;

      toast.success(`"${created.name}" created!`);
      onSave(created as NewRestaurantResult);
    } catch (err: any) {
      console.error('[NewRestaurantForm] Error:', err);
      toast.error(err.message ?? 'Failed to create restaurant');
    } finally {
      setSaving(false);
    }
  };

  const filteredCuisines = CUISINES.filter(c =>
    c.toLowerCase().includes(cuisineSearch.toLowerCase())
  );

  // ---- render ----

  const inner = (
    <div className={cn('space-y-4', compact && 'text-sm')}>
      {/* Basic Information */}
      <SectionCard
        compact={compact}
        title="Basic Information"
        icon={<Utensils className={cn('text-orange-600', compact ? 'h-4 w-4' : 'h-5 w-5')} />}
        description={!compact ? 'General details about the restaurant' : undefined}
        collapsible={compact}
        defaultOpen
      >
        <div className="space-y-3">
          <div>
            <Label htmlFor="nrf-name">
              Restaurant Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="nrf-name"
              value={formData.name}
              onChange={e => set({ name: e.target.value })}
              placeholder="e.g. The Golden Spoon"
              className="mt-1"
              autoFocus={compact}
            />
          </div>

          <div>
            <Label htmlFor="nrf-type">Restaurant Type</Label>
            <Select
              value={formData.restaurant_type}
              onValueChange={v => set({ restaurant_type: v })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {RESTAURANT_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>
                    <span className="font-medium">{t.label}</span>
                    {!compact && (
                      <span className="text-xs text-muted-foreground ml-1">— {t.description}</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="nrf-phone">Phone</Label>
              <Input
                id="nrf-phone"
                type="tel"
                value={formData.phone}
                onChange={e => set({ phone: e.target.value })}
                placeholder="+52 33 1234 5678"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="nrf-website">Website</Label>
              <Input
                id="nrf-website"
                type="text"
                value={formData.website}
                onChange={e => set({ website: e.target.value })}
                placeholder="example.com"
                className="mt-1"
              />
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Location */}
      <SectionCard
        compact={compact}
        title="Location"
        icon={<MapPin className={cn('text-orange-600', compact ? 'h-4 w-4' : 'h-5 w-5')} />}
        description={!compact ? 'Where can customers find this restaurant?' : undefined}
        collapsible={compact}
        defaultOpen
      >
        <div className="space-y-3">
          <div className="flex items-start gap-2 text-xs text-gray-600 bg-blue-50 p-2.5 rounded-lg">
            <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-600" />
            <p>Click the map to pin location — address, city, postcode and country auto-fill.</p>
          </div>

          <LocationPickerDynamic
            initialLat={mapCoordinates?.lat}
            initialLng={mapCoordinates?.lng}
            onLocationSelect={handleLocationSelect}
            onAddressSelect={handleAddressSelect}
            onLocationDetails={handleLocationDetails}
          />

          <div>
            <Label>Country</Label>
            <Select value={formData.country_code} onValueChange={v => set({ country_code: v })}>
              <SelectTrigger className="mt-1">
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="nrf-city">City</Label>
              <Input
                id="nrf-city"
                value={formData.city}
                onChange={e => set({ city: e.target.value })}
                placeholder="Guadalajara"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="nrf-postal">Postal Code</Label>
              <Input
                id="nrf-postal"
                value={formData.postal_code}
                onChange={e => set({ postal_code: e.target.value })}
                placeholder="44100"
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="nrf-neighbourhood">
                Neighbourhood <span className="text-gray-400 font-normal text-xs">(optional)</span>
              </Label>
              <Input
                id="nrf-neighbourhood"
                value={formData.neighbourhood}
                onChange={e => set({ neighbourhood: e.target.value })}
                placeholder="Downtown"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="nrf-state">State / Province</Label>
              <Input
                id="nrf-state"
                value={formData.state}
                onChange={e => set({ state: e.target.value })}
                placeholder="Jalisco"
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="nrf-address">Full Address</Label>
            <Input
              id="nrf-address"
              value={formData.address}
              onChange={e => set({ address: e.target.value })}
              placeholder="Av. Chapultepec 123, Col. Americana"
              className="mt-1"
            />
          </div>

          {formData.latitude && formData.longitude && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Latitude</Label>
                <Input value={formData.latitude} readOnly className="mt-1 bg-gray-50 text-xs" />
              </div>
              <div>
                <Label>Longitude</Label>
                <Input value={formData.longitude} readOnly className="mt-1 bg-gray-50 text-xs" />
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      {/* Cuisine Types */}
      <SectionCard
        compact={compact}
        title="Cuisine Types"
        collapsible={compact}
        defaultOpen={!compact}
      >
        <div className="space-y-3">
          {selectedCuisines.length > 0 && (
            <div className="flex flex-wrap gap-1.5 p-2 bg-gray-50 rounded-lg">
              {selectedCuisines.map(c => (
                <Badge key={c} variant="secondary" className="text-xs">
                  {c}
                  <button
                    type="button"
                    onClick={() => handleCuisineToggle(c)}
                    className="ml-1.5 hover:text-red-600"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          <Input
            placeholder="Search cuisines…"
            value={cuisineSearch}
            onChange={e => setCuisineSearch(e.target.value)}
          />

          {!cuisineSearch && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">Popular</p>
              <div className="grid grid-cols-2 gap-1.5 p-2 border rounded-lg bg-orange-50">
                {POPULAR_CUISINES.map(c => (
                  <label key={c} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={selectedCuisines.includes(c)}
                      onCheckedChange={() => handleCuisineToggle(c)}
                    />
                    <span className="text-xs font-medium hover:text-orange-600">{c}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs font-semibold text-gray-500 mt-3 mb-2">All Cuisines</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto p-2 border rounded-lg">
            {filteredCuisines.map(c => (
              <label key={c} className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={selectedCuisines.includes(c)}
                  onCheckedChange={() => handleCuisineToggle(c)}
                />
                <span className="text-xs hover:text-orange-600">{c}</span>
              </label>
            ))}
          </div>
        </div>
      </SectionCard>

      {/* Operating Hours */}
      <SectionCard
        compact={compact}
        title="Operating Hours"
        icon={<Clock className={cn('text-orange-600', compact ? 'h-4 w-4' : 'h-5 w-5')} />}
        description={!compact ? 'When is the restaurant open?' : undefined}
        collapsible={compact}
        defaultOpen={!compact}
      >
        <div className="space-y-3">
          {/* Quick-fill */}
          <div className="flex flex-wrap items-center gap-2 p-2.5 bg-orange-50 border border-orange-200 rounded-lg">
            <span className="text-xs font-medium text-gray-700 shrink-0">Quick fill:</span>
            <Input
              type="time"
              value={quickHours.open}
              onChange={e => setQuickHours(q => ({ ...q, open: e.target.value }))}
              className="w-28 h-8 text-xs"
            />
            <span className="text-xs text-gray-400">to</span>
            <Input
              type="time"
              value={quickHours.close}
              onChange={e => setQuickHours(q => ({ ...q, close: e.target.value }))}
              className="w-28 h-8 text-xs"
            />
            <div className="flex gap-1.5 flex-wrap">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => applyQuickHours(DAYS_OF_WEEK.map(d => d.key))}
              >
                All
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs"
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
                className="h-7 text-xs"
                onClick={() => applyQuickHours(['saturday', 'sunday'])}
              >
                Weekends
              </Button>
            </div>
          </div>

          <Separator />

          {DAYS_OF_WEEK.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-2">
              <span className="w-8 text-xs font-medium text-gray-600">{label}</span>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <Checkbox
                  checked={operatingHours[key]?.closed || false}
                  onCheckedChange={() => handleDayClosedToggle(key)}
                />
                <span className="text-xs text-gray-500">Closed</span>
              </label>
              {!operatingHours[key]?.closed && (
                <div className="flex items-center gap-1.5 ml-1">
                  <Input
                    type="time"
                    value={operatingHours[key]?.open || '09:00'}
                    onChange={e => handleHoursChange(key, 'open', e.target.value)}
                    className="w-28 h-7 text-xs"
                  />
                  <span className="text-xs text-gray-400">–</span>
                  <Input
                    type="time"
                    value={operatingHours[key]?.close || '21:00'}
                    onChange={e => handleHoursChange(key, 'close', e.target.value)}
                    className="w-28 h-7 text-xs"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Service Options */}
      <SectionCard
        compact={compact}
        title="Service Options"
        collapsible={compact}
        defaultOpen={!compact}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['delivery_available', 'Delivery'],
                ['takeout_available', 'Takeout'],
                ['dine_in_available', 'Dine-in'],
                ['accepts_reservations', 'Reservations'],
              ] as [keyof typeof formData, string][]
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={formData[key] as boolean}
                  onCheckedChange={checked => set({ [key]: !!checked })}
                />
                <span className="text-xs">{label}</span>
              </label>
            ))}
          </div>

          <Separator />

          <div>
            <Label className="mb-1.5 block">Service Speed</Label>
            <Select
              value={formData.service_speed}
              onValueChange={v => set({ service_speed: v as 'fast-food' | 'regular' })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fast-food">
                  <span className="font-medium">Fast Food</span>
                  <span className="text-xs text-muted-foreground ml-1">— under 10 min</span>
                </SelectItem>
                <SelectItem value="regular">
                  <span className="font-medium">Regular Service</span>
                  <span className="text-xs text-muted-foreground ml-1">— standard</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </SectionCard>

      {/* Action buttons */}
      <div className={cn('flex gap-2', compact ? 'pt-1' : 'pt-4 justify-end')}>
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={saving}
            size={compact ? 'sm' : 'default'}
          >
            Cancel
          </Button>
        )}
        <Button
          type={compact ? 'button' : 'submit'}
          onClick={compact ? () => handleSubmit() : undefined}
          disabled={saving || !formData.name.trim()}
          className="bg-orange-600 hover:bg-orange-700 text-white"
          size={compact ? 'sm' : 'lg'}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
          {compact ? 'Create & Select' : 'Create Restaurant'}
        </Button>
      </div>
    </div>
  );

  if (compact) return inner;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {inner}
    </form>
  );
}
