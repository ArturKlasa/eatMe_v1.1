'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Loader2, MapPin, Utensils, Building2, Globe, Clock } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { RESTAURANT_TYPES, CUISINES, POPULAR_CUISINES, COUNTRIES } from '@/lib/constants';
import type { ParsedLocationDetails } from '@/lib/parseAddress';

const LocationPicker = dynamic(() => import('@/components/LocationPicker'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center">
      <p className="text-gray-500">Loading map...</p>
    </div>
  ),
});

export default function EditRestaurantPage() {
  const router = useRouter();
  const params = useParams();
  const restaurantId = params.id as string;

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    neighbourhood: '',
    state: '',
    postal_code: '',
    country_code: 'US',
    phone: '',
    website: '',
    description: '',
    restaurant_type: 'restaurant',
    cuisine_types: [] as string[],
    latitude: '',
    longitude: '',
    delivery_available: false,
    takeout_available: false,
    dine_in_available: true,
    accepts_reservations: false,
  });

  const [cuisineSearch, setCuisineSearch] = useState('');

  const DAYS_OF_WEEK = [
    { key: 'monday', label: 'Monday' },
    { key: 'tuesday', label: 'Tuesday' },
    { key: 'wednesday', label: 'Wednesday' },
    { key: 'thursday', label: 'Thursday' },
    { key: 'friday', label: 'Friday' },
    { key: 'saturday', label: 'Saturday' },
    { key: 'sunday', label: 'Sunday' },
  ];

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

  useEffect(() => {
    const fetchRestaurant = async () => {
      try {
        const { data, error } = await supabase
          .from('restaurants')
          .select('*')
          .eq('id', restaurantId)
          .single();

        if (error) {
          console.error('[Admin] Error fetching restaurant:', error);
          toast.error('Failed to load restaurant');
          router.push('/admin/restaurants');
          return;
        }

        if (data) {
          setFormData({
            name: data.name || '',
            address: data.address || '',
            city: data.city || '',
            neighbourhood: data.neighbourhood || '',
            state: data.state || '',
            postal_code: data.postal_code || '',
            country_code: data.country_code || 'US',
            phone: data.phone || '',
            website: data.website || '',
            description: data.description || '',
            restaurant_type: data.restaurant_type || 'restaurant',
            cuisine_types: data.cuisine_types || [],
            latitude: data.location?.lat?.toString() || '',
            longitude: data.location?.lng?.toString() || '',
            delivery_available: data.delivery_available || false,
            takeout_available: data.takeout_available || false,
            dine_in_available: data.dine_in_available !== false,
            accepts_reservations: data.accepts_reservations || false,
          });

          // Populate operating hours from DB (open_hours stores only open days)
          if (data.open_hours) {
            setOperatingHours(prev => {
              const next = { ...prev };
              DAYS_OF_WEEK.forEach(({ key }) => {
                const saved = data.open_hours?.[key];
                next[key] = saved
                  ? { open: saved.open, close: saved.close, closed: false }
                  : { ...prev[key], closed: true };
              });
              return next;
            });
          }
        }
      } catch (error) {
        console.error('[Admin] Unexpected error:', error);
        toast.error('An unexpected error occurred');
        router.push('/admin/restaurants');
      } finally {
        setFetching(false);
      }
    };

    fetchRestaurant();
  }, [restaurantId, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const lat = parseFloat(formData.latitude);
      const lng = parseFloat(formData.longitude);

      if (isNaN(lat) || isNaN(lng)) {
        toast.error('Please enter valid coordinates');
        setLoading(false);
        return;
      }

      // Build open_hours: only include days that are not closed
      const open_hours: Record<string, { open: string; close: string }> = {};
      Object.entries(operatingHours).forEach(([day, hours]) => {
        if (!hours.closed) {
          open_hours[day] = { open: hours.open, close: hours.close };
        }
      });

      const { error } = await supabase
        .from('restaurants')
        .update({
          name: formData.name,
          address: formData.address,
          city: formData.city,
          neighbourhood: formData.neighbourhood,
          state: formData.state,
          postal_code: formData.postal_code,
          country_code: formData.country_code,
          phone: formData.phone,
          website: formData.website,
          description: formData.description || null,
          restaurant_type: formData.restaurant_type,
          cuisine_types: formData.cuisine_types,
          location: { lat, lng },
          open_hours,
          delivery_available: formData.delivery_available,
          takeout_available: formData.takeout_available,
          dine_in_available: formData.dine_in_available,
          accepts_reservations: formData.accepts_reservations,
        })
        .eq('id', restaurantId);

      if (error) {
        console.error('[Admin] Error updating restaurant:', error);
        toast.error('Failed to update restaurant');
        setLoading(false);
        return;
      }

      toast.success('Restaurant updated successfully!');
      router.push('/admin/restaurants');
    } catch (error) {
      console.error('[Admin] Unexpected error:', error);
      toast.error('An unexpected error occurred');
      setLoading(false);
    }
  };

  const handleLocationSelect = (lat: number, lng: number) => {
    setFormData({
      ...formData,
      latitude: lat.toString(),
      longitude: lng.toString(),
    });
    toast.success('Location marked on map!');
  };

  const handleAddressSelect = (address: string) => {
    console.log('[Admin] Address received from reverse geocoding:', address);
    setFormData(prev => ({
      ...prev,
      address,
    }));
    toast.success('Address auto-filled from map location!');
  };

  /**
   * Called by LocationPicker after a successful reverse-geocoding lookup.
   * Auto-fills country_code, city, neighbourhood, state and postal_code from the structured Nominatim data.
   */
  const handleLocationDetails = (details: ParsedLocationDetails) => {
    console.log('[Admin] Location details from reverse geocoding:', details);
    setFormData(prev => {
      const supportedCountry = COUNTRIES.find(c => c.value === details.countryCode);
      return {
        ...prev,
        city: details.city || prev.city,
        neighbourhood: details.neighbourhood || prev.neighbourhood,
        state: details.state || prev.state,
        postal_code: details.postalCode || prev.postal_code,
        country_code: supportedCountry ? details.countryCode : prev.country_code,
      };
    });
  };

  const handleCuisineToggle = (cuisine: string) => {
    setFormData(prev => ({
      ...prev,
      cuisine_types: prev.cuisine_types.includes(cuisine)
        ? prev.cuisine_types.filter(c => c !== cuisine)
        : [...prev.cuisine_types, cuisine],
    }));
  };

  const handleDayClosedToggle = (day: string) => {
    setOperatingHours(prev => ({
      ...prev,
      [day]: { ...prev[day], closed: !prev[day].closed },
    }));
  };

  const handleHoursChange = (day: string, field: 'open' | 'close', value: string) => {
    setOperatingHours(prev => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  };

  const [quickHours, setQuickHours] = useState({ open: '09:00', close: '21:00' });

  const applyQuickHours = (days: string[]) => {
    setOperatingHours(prev => {
      const next = { ...prev };
      days.forEach(day => {
        next[day] = { open: quickHours.open, close: quickHours.close, closed: false };
      });
      return next;
    });
  };

  const handleRemoveCuisine = (cuisine: string) => {
    setFormData(prev => ({
      ...prev,
      cuisine_types: prev.cuisine_types.filter(c => c !== cuisine),
    }));
  };

  // Filter cuisines based on search
  const filteredCuisines = cuisineSearch
    ? CUISINES.filter(c => c.toLowerCase().includes(cuisineSearch.toLowerCase()))
    : POPULAR_CUISINES;

  if (fetching) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/restaurants" className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Edit Restaurant</h1>
            <p className="mt-2 text-gray-600">Update restaurant information</p>
          </div>
        </div>

        <Button asChild variant="outline">
          <Link href={`/admin/restaurants/${restaurantId}/menus`}>Manage Menus</Link>
        </Button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-orange-600" />
              <CardTitle>Basic Information</CardTitle>
            </div>
            <CardDescription>Tell us about your restaurant</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Restaurant Name *</Label>
              <Input
                id="name"
                required
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Mario's Italian Kitchen"
              />
            </div>

            {/* Type */}
            <div className="space-y-2">
              <Label htmlFor="type">Restaurant Type *</Label>
              <Select
                value={formData.restaurant_type}
                onValueChange={value => setFormData({ ...formData, restaurant_type: value })}
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RESTAURANT_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                className="w-full min-h-[100px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Share what makes your restaurant special..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Cuisines Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Utensils className="h-5 w-5 text-orange-600" />
              <CardTitle>Cuisine Types</CardTitle>
            </div>
            <CardDescription>Select all that apply</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Selected Cuisines */}
            {formData.cuisine_types.length > 0 && (
              <div className="flex flex-wrap gap-2 p-3 bg-orange-50 rounded-lg">
                {formData.cuisine_types.map(cuisine => (
                  <Badge
                    key={cuisine}
                    variant="secondary"
                    className="cursor-pointer hover:bg-orange-200"
                    onClick={() => handleRemoveCuisine(cuisine)}
                  >
                    {cuisine} ×
                  </Badge>
                ))}
              </div>
            )}

            {/* Search */}
            <div>
              <Input
                type="text"
                placeholder="Search cuisines..."
                value={cuisineSearch}
                onChange={e => setCuisineSearch(e.target.value)}
              />
            </div>

            {/* Cuisine Options */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {filteredCuisines.map(cuisine => (
                <div
                  key={cuisine}
                  onClick={() => handleCuisineToggle(cuisine)}
                  className={`p-3 border rounded-lg cursor-pointer transition-all ${
                    formData.cuisine_types.includes(cuisine)
                      ? 'border-orange-600 bg-orange-50'
                      : 'border-gray-200 hover:border-orange-400 hover:bg-orange-50/50'
                  }`}
                >
                  <p className="text-sm font-medium text-center">{cuisine}</p>
                </div>
              ))}
            </div>

            {cuisineSearch && filteredCuisines.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">
                No cuisines found matching &quot;{cuisineSearch}&quot;
              </p>
            )}
          </CardContent>
        </Card>

        {/* Location Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-orange-600" />
              <CardTitle>Location</CardTitle>
            </div>
            <CardDescription>Where can customers find you?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-2 text-sm text-gray-600 bg-blue-50 p-3 rounded-md">
              <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-blue-600" />
              <p>
                Click anywhere on the map to update the location. Country, city, postal code and
                address will be auto-filled — you can still edit them manually.
              </p>
            </div>

            <LocationPicker
              initialLat={formData.latitude ? parseFloat(formData.latitude) : undefined}
              initialLng={formData.longitude ? parseFloat(formData.longitude) : undefined}
              onLocationSelect={handleLocationSelect}
              onAddressSelect={handleAddressSelect}
              onLocationDetails={handleLocationDetails}
            />

            {/* City, Postal, Country */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  required
                  value={formData.city}
                  onChange={e => setFormData({ ...formData, city: e.target.value })}
                  placeholder="New York"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postal">Postal Code</Label>
                <Input
                  id="postal"
                  value={formData.postal_code}
                  onChange={e => setFormData({ ...formData, postal_code: e.target.value })}
                  placeholder="10001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country *</Label>
                <Select
                  value={formData.country_code}
                  onValueChange={value => setFormData({ ...formData, country_code: value })}
                >
                  <SelectTrigger id="country">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map(country => (
                      <SelectItem key={country.value} value={country.value}>
                        {country.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Neighbourhood, State */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="neighbourhood">
                  Neighbourhood{' '}
                  <span className="text-gray-400 font-normal text-xs">(optional)</span>
                </Label>
                <Input
                  id="neighbourhood"
                  value={formData.neighbourhood}
                  onChange={e => setFormData({ ...formData, neighbourhood: e.target.value })}
                  placeholder="Downtown"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State / Province</Label>
                <Input
                  id="state"
                  value={formData.state}
                  onChange={e => setFormData({ ...formData, state: e.target.value })}
                  placeholder="California"
                />
              </div>
            </div>

            {/* Address */}
            <div className="space-y-2">
              <Label htmlFor="address">Street Address *</Label>
              <Input
                id="address"
                required
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
                placeholder="123 Main Street"
              />
            </div>

            {/* Coordinates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="lat">Latitude *</Label>
                <Input
                  id="lat"
                  type="number"
                  step="any"
                  required
                  value={formData.latitude}
                  readOnly
                  placeholder="Click map to set"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lng">Longitude *</Label>
                <Input
                  id="lng"
                  type="number"
                  step="any"
                  required
                  value={formData.longitude}
                  readOnly
                  placeholder="Click map to set"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-orange-600" />
              <CardTitle>Contact Information</CardTitle>
            </div>
            <CardDescription>How can customers reach you?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+1 (555) 123-4567"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  type="url"
                  value={formData.website}
                  onChange={e => setFormData({ ...formData, website: e.target.value })}
                  placeholder="https://yourrestaurant.com"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Service Options Card */}
        <Card>
          <CardHeader>
            <CardTitle>Service Options</CardTitle>
            <CardDescription>What services do you offer?</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="delivery"
                  checked={formData.delivery_available}
                  onCheckedChange={checked =>
                    setFormData({ ...formData, delivery_available: checked as boolean })
                  }
                />
                <Label htmlFor="delivery" className="cursor-pointer">
                  🚚 Delivery Available
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="takeout"
                  checked={formData.takeout_available}
                  onCheckedChange={checked =>
                    setFormData({ ...formData, takeout_available: checked as boolean })
                  }
                />
                <Label htmlFor="takeout" className="cursor-pointer">
                  🥡 Takeout Available
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="dinein"
                  checked={formData.dine_in_available}
                  onCheckedChange={checked =>
                    setFormData({ ...formData, dine_in_available: checked as boolean })
                  }
                />
                <Label htmlFor="dinein" className="cursor-pointer">
                  🍽️ Dine-in Available
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="reservations"
                  checked={formData.accepts_reservations}
                  onCheckedChange={checked =>
                    setFormData({ ...formData, accepts_reservations: checked as boolean })
                  }
                />
                <Label htmlFor="reservations" className="cursor-pointer">
                  📅 Accepts Reservations
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Operating Hours Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-600" />
              <CardTitle>Operating Hours</CardTitle>
            </div>
            <CardDescription>When is this restaurant open for business?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Quick-fill strip */}
            <div className="flex flex-wrap items-center gap-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <span className="text-sm font-medium text-gray-700 shrink-0">Apply to:</span>
              <Input
                type="time"
                value={quickHours.open}
                onChange={e => setQuickHours(q => ({ ...q, open: e.target.value }))}
                className="w-32"
              />
              <span className="text-sm text-gray-500">to</span>
              <Input
                type="time"
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
                      checked={operatingHours[key]?.closed || false}
                      onCheckedChange={() => handleDayClosedToggle(key)}
                    />
                    <Label
                      htmlFor={`closed-${key}`}
                      className="text-sm text-gray-500 cursor-pointer"
                    >
                      Closed
                    </Label>
                    {!operatingHours[key]?.closed && (
                      <>
                        <Input
                          type="time"
                          value={operatingHours[key]?.open || '09:00'}
                          onChange={e => handleHoursChange(key, 'open', e.target.value)}
                          className="w-32"
                        />
                        <span className="text-gray-500 text-sm">to</span>
                        <Input
                          type="time"
                          value={operatingHours[key]?.close || '21:00'}
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
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-4">
          <Button type="submit" disabled={loading} className="flex items-center gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/admin/restaurants">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
