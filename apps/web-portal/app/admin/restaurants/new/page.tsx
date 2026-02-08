'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Loader2, Utensils, MapPin, Clock, X } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CUISINES, RESTAURANT_TYPES, COUNTRIES, POPULAR_CUISINES } from '@/lib/constants';

const LocationPicker = dynamic(() => import('@/components/LocationPicker'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-64 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
      <p className="text-gray-500 text-sm">Loading map...</p>
    </div>
  ),
});

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
];

export default function NewRestaurantPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [cuisineSearch, setCuisineSearch] = useState('');
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([]);
  const [mapCoordinates, setMapCoordinates] = useState<{ lat: number; lng: number } | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    postal_code: '',
    country_code: 'US',
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

  const handleCuisineToggle = (cuisine: string) => {
    setSelectedCuisines(prev =>
      prev.includes(cuisine) ? prev.filter(c => c !== cuisine) : [...prev, cuisine]
    );
  };

  const handleRemoveCuisine = (cuisine: string) => {
    setSelectedCuisines(prev => prev.filter(c => c !== cuisine));
  };

  const handleDayClosedToggle = (day: string) => {
    setOperatingHours(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        closed: !prev[day].closed,
      },
    }));
  };

  const handleHoursChange = (day: string, field: 'open' | 'close', value: string) => {
    setOperatingHours(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value,
      },
    }));
  };

  const handleLocationSelect = (lat: number, lng: number) => {
    setFormData({
      ...formData,
      latitude: lat.toString(),
      longitude: lng.toString(),
    });
    setMapCoordinates({ lat, lng });
    toast.success('Location marked on map!');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validation
      if (selectedCuisines.length === 0) {
        toast.error('Please select at least one cuisine type');
        setLoading(false);
        return;
      }

      const lat = parseFloat(formData.latitude);
      const lng = parseFloat(formData.longitude);

      if (isNaN(lat) || isNaN(lng)) {
        toast.error('Please mark the location on the map');
        setLoading(false);
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast.error('Not authenticated');
        setLoading(false);
        return;
      }

      // Build operating hours (exclude closed days)
      const open_hours: Record<string, { open: string; close: string }> = {};
      Object.entries(operatingHours).forEach(([day, hours]) => {
        if (!hours.closed) {
          open_hours[day] = {
            open: hours.open,
            close: hours.close,
          };
        }
      });

      const { error } = await supabase.from('restaurants').insert({
        name: formData.name,
        address: formData.address,
        city: formData.city || null,
        postal_code: formData.postal_code || null,
        country_code: formData.country_code,
        phone: formData.phone || null,
        website: formData.website || null,
        restaurant_type: formData.restaurant_type,
        cuisine_types: selectedCuisines,
        location: { lat, lng },
        open_hours,
        delivery_available: formData.delivery_available,
        takeout_available: formData.takeout_available,
        dine_in_available: formData.dine_in_available,
        service_speed: formData.service_speed,
        accepts_reservations: formData.accepts_reservations,
        owner_id: userData.user.id,
        is_active: true,
      });

      if (error) {
        console.error('[Admin] Error creating restaurant:', error);
        toast.error('Failed to create restaurant');
        setLoading(false);
        return;
      }

      toast.success('Restaurant created successfully!');
      router.push('/admin/restaurants');
    } catch (error) {
      console.error('[Admin] Unexpected error:', error);
      toast.error('An unexpected error occurred');
      setLoading(false);
    }
  };

  const filteredCuisines = CUISINES.filter(cuisine =>
    cuisine.toLowerCase().includes(cuisineSearch.toLowerCase())
  );

  // Memoize LocationPicker to prevent re-renders when other form fields change
  const memoizedLocationPicker = useMemo(() => {
    return (
      <LocationPicker
        initialLat={mapCoordinates?.lat}
        initialLng={mapCoordinates?.lng}
        onLocationSelect={handleLocationSelect}
      />
    );
  }, [mapCoordinates?.lat, mapCoordinates?.lng]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link href="/admin/restaurants">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Restaurants
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Add New Restaurant</h1>
          <p className="text-gray-600 mt-2">Create a new restaurant listing (Admin)</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
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
              <div>
                <Label htmlFor="name">
                  Restaurant Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., The Golden Spoon"
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="restaurant_type">
                  Restaurant Type <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.restaurant_type}
                  onValueChange={value => setFormData({ ...formData, restaurant_type: value })}
                >
                  <SelectTrigger className="mt-2">
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+1 (555) 123-4567"
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    type="text"
                    value={formData.website}
                    onChange={e => setFormData({ ...formData, website: e.target.value })}
                    placeholder="example.com"
                    className="mt-2"
                  />
                </div>
              </div>
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
              <div>
                <Label htmlFor="country_code">
                  Country <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.country_code}
                  onValueChange={value => setFormData({ ...formData, country_code: value })}
                >
                  <SelectTrigger className="mt-2">
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

              <div>
                <Label htmlFor="address">
                  Full Address <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="address"
                  required
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  placeholder="123 Main Street, City, State, ZIP"
                  className="mt-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={e => setFormData({ ...formData, city: e.target.value })}
                    placeholder="San Francisco"
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="postal_code">Postal Code</Label>
                  <Input
                    id="postal_code"
                    value={formData.postal_code}
                    onChange={e => setFormData({ ...formData, postal_code: e.target.value })}
                    placeholder="94102"
                    className="mt-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="latitude">Latitude</Label>
                  <Input
                    id="latitude"
                    value={formData.latitude}
                    placeholder="40.7128"
                    type="number"
                    step="any"
                    readOnly
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="longitude">Longitude</Label>
                  <Input
                    id="longitude"
                    value={formData.longitude}
                    placeholder="-74.0060"
                    type="number"
                    step="any"
                    readOnly
                    className="mt-2"
                  />
                </div>
              </div>

              <p className="text-sm text-gray-500">
                Click on the map below to mark the restaurant location and get coordinates
                automatically.
              </p>

              {memoizedLocationPicker}
            </CardContent>
          </Card>

          {/* Cuisines */}
          <Card>
            <CardHeader>
              <CardTitle>
                Cuisine Types <span className="text-red-500">*</span>
              </CardTitle>
              <CardDescription>Select all cuisines that apply to this restaurant</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedCuisines.length > 0 && (
                <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-lg">
                  {selectedCuisines.map(cuisine => (
                    <Badge key={cuisine} variant="secondary" className="text-sm">
                      {cuisine}
                      <button
                        type="button"
                        onClick={() => handleRemoveCuisine(cuisine)}
                        className="ml-2 hover:text-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              <div>
                <Input
                  placeholder="Search cuisines..."
                  value={cuisineSearch}
                  onChange={e => setCuisineSearch(e.target.value)}
                  className="mb-3"
                />
              </div>

              {!cuisineSearch && (
                <>
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Most Popular</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 p-2 border rounded-lg bg-orange-50">
                      {POPULAR_CUISINES.map(cuisine => (
                        <div key={cuisine} className="flex items-center space-x-2">
                          <Checkbox
                            id={`cuisine-${cuisine}`}
                            checked={selectedCuisines.includes(cuisine)}
                            onCheckedChange={() => handleCuisineToggle(cuisine)}
                          />
                          <label
                            htmlFor={`cuisine-${cuisine}`}
                            className="text-sm cursor-pointer hover:text-orange-600 font-medium"
                          >
                            {cuisine}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <h4 className="text-sm font-semibold text-gray-700 mb-2">All Cuisines</h4>
                </>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-64 overflow-y-auto p-2 border rounded-lg">
                {filteredCuisines.map(cuisine => (
                  <div key={cuisine} className="flex items-center space-x-2">
                    <Checkbox
                      id={`cuisine-${cuisine}`}
                      checked={selectedCuisines.includes(cuisine)}
                      onCheckedChange={() => handleCuisineToggle(cuisine)}
                    />
                    <label
                      htmlFor={`cuisine-${cuisine}`}
                      className="text-sm cursor-pointer hover:text-orange-600"
                    >
                      {cuisine}
                    </label>
                  </div>
                ))}
              </div>
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
            <CardContent className="space-y-3">
              {DAYS_OF_WEEK.map(({ key, label }) => (
                <div key={key} className="flex items-center gap-4">
                  <div className="w-28">
                    <Label className="text-sm font-medium">{label}</Label>
                  </div>
                  <div className="flex items-center gap-3 flex-1">
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
                        <span className="text-gray-500">to</span>
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
              ))}
            </CardContent>
          </Card>

          {/* Service Options */}
          <Card>
            <CardHeader>
              <CardTitle>Service Options</CardTitle>
              <CardDescription>What services does this restaurant offer?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="delivery_available"
                    checked={formData.delivery_available}
                    onCheckedChange={checked =>
                      setFormData({ ...formData, delivery_available: !!checked })
                    }
                  />
                  <Label htmlFor="delivery_available" className="cursor-pointer">
                    Delivery Available
                  </Label>
                </div>
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="takeout_available"
                    checked={formData.takeout_available}
                    onCheckedChange={checked =>
                      setFormData({ ...formData, takeout_available: !!checked })
                    }
                  />
                  <Label htmlFor="takeout_available" className="cursor-pointer">
                    Takeout Available
                  </Label>
                </div>
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="dine_in_available"
                    checked={formData.dine_in_available}
                    onCheckedChange={checked =>
                      setFormData({ ...formData, dine_in_available: !!checked })
                    }
                  />
                  <Label htmlFor="dine_in_available" className="cursor-pointer">
                    Dine-in Available
                  </Label>
                </div>
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="accepts_reservations"
                    checked={formData.accepts_reservations}
                    onCheckedChange={checked =>
                      setFormData({ ...formData, accepts_reservations: !!checked })
                    }
                  />
                  <Label htmlFor="accepts_reservations" className="cursor-pointer">
                    Accepts Reservations
                  </Label>
                </div>
              </div>

              <Separator />

              <div>
                <Label className="mb-3 block">Service Speed</Label>
                <Select
                  value={formData.service_speed}
                  onValueChange={value =>
                    setFormData({ ...formData, service_speed: value as 'fast-food' | 'regular' })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fast-food">
                      <div>
                        <div className="font-medium">Fast Food</div>
                        <div className="text-xs text-muted-foreground">
                          Quick service, typically under 10 minutes
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="regular">
                      <div>
                        <div className="font-medium">Regular Service</div>
                        <div className="text-xs text-muted-foreground">
                          Standard restaurant service
                        </div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-between pt-4">
            <Link href="/admin/restaurants">
              <Button type="button" variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              disabled={loading}
              size="lg"
              className="bg-orange-600 hover:bg-orange-700"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Restaurant
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
