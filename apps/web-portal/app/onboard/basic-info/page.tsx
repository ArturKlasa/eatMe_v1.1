'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { loadRestaurantData, saveRestaurantData } from '@/lib/storage';
import {
  CUISINES,
  RESTAURANT_TYPES,
  COUNTRIES,
  POPULAR_CUISINES,
  SERVICE_SPEED_OPTIONS,
} from '@/lib/constants';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import {
  RestaurantBasicInfo,
  RestaurantOperations,
  FormProgress,
  RestaurantType,
} from '@/types/restaurant';
import { ArrowLeft, ArrowRight, MapPin, Clock, Utensils, X } from 'lucide-react';
import { toast } from 'sonner';

// Dynamically import LocationPicker to avoid SSR issues
const LocationPicker = dynamic(() => import('@/components/LocationPicker'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-64 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
      <p className="text-gray-500 text-sm">Loading map...</p>
    </div>
  ),
});

interface FormData {
  name: string;
  restaurant_type: string;
  description: string;
  country: string;
  address: string;
  location_lat: string;
  location_lng: string;
  phone: string;
  website: string;
  delivery_available: boolean;
  takeout_available: boolean;
  dine_in_available: boolean;
  service_speed?: 'fast-food' | 'regular';
  accepts_reservations: boolean;
}

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
];

function BasicInfoPageContent() {
  const router = useRouter();
  const { user } = useAuth();
  const [cuisineSearch, setCuisineSearch] = useState('');

  // Initialize map coordinates from saved data
  const [mapCoordinates, setMapCoordinates] = useState<{ lat: number; lng: number } | null>(() => {
    if (typeof window === 'undefined' || !user?.id) return null;
    const savedData = loadRestaurantData(user.id);
    if (savedData?.basicInfo?.location?.lat && savedData?.basicInfo?.location?.lng) {
      return {
        lat: savedData.basicInfo.location.lat,
        lng: savedData.basicInfo.location.lng,
      };
    }
    return null;
  });

  // Initialize cuisines and price range from saved data
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>(() => {
    if (typeof window === 'undefined' || !user?.id) return [];
    const savedData = loadRestaurantData(user.id);
    return savedData?.basicInfo?.cuisines || [];
  });

  // Initialize restaurant type from saved data
  const [restaurantType, setRestaurantType] = useState<string>(() => {
    if (typeof window === 'undefined' || !user?.id) return 'restaurant';
    const savedData = loadRestaurantData(user.id);
    return savedData?.basicInfo?.restaurant_type || 'restaurant';
  });

  // Initialize country from saved data
  const [country, setCountry] = useState<string>(() => {
    if (typeof window === 'undefined' || !user?.id) return 'US';
    const savedData = loadRestaurantData(user.id);
    return savedData?.basicInfo?.country || 'US';
  });

  // Initialize service speed from saved data
  const [serviceSpeed, setServiceSpeed] = useState<'fast-food' | 'regular'>(() => {
    if (typeof window === 'undefined' || !user?.id) return 'regular';
    const savedData = loadRestaurantData(user.id);
    return savedData?.operations?.service_speed || 'regular';
  });

  const [operatingHours, setOperatingHours] = useState<
    Record<string, { open: string; close: string; closed: boolean }>
  >(() => {
    if (typeof window === 'undefined') {
      return {
        monday: { open: '09:00', close: '21:00', closed: false },
        tuesday: { open: '09:00', close: '21:00', closed: false },
        wednesday: { open: '09:00', close: '21:00', closed: false },
        thursday: { open: '09:00', close: '21:00', closed: false },
        friday: { open: '09:00', close: '22:00', closed: false },
        saturday: { open: '09:00', close: '22:00', closed: false },
        sunday: { open: '10:00', close: '20:00', closed: false },
      };
    }

    const savedData = loadRestaurantData(user.id);
    if (savedData?.operations?.operating_hours) {
      const hours: Record<string, { open: string; close: string; closed: boolean }> = {};
      DAYS_OF_WEEK.forEach(({ key }) => {
        const dayHours =
          savedData.operations.operating_hours?.[
            key as keyof typeof savedData.operations.operating_hours
          ];
        if (dayHours) {
          hours[key] = { ...dayHours, closed: false };
        } else {
          hours[key] = { open: '09:00', close: '21:00', closed: true };
        }
      });
      return hours;
    }

    return {
      monday: { open: '09:00', close: '21:00', closed: false },
      tuesday: { open: '09:00', close: '21:00', closed: false },
      wednesday: { open: '09:00', close: '21:00', closed: false },
      thursday: { open: '09:00', close: '21:00', closed: false },
      friday: { open: '09:00', close: '22:00', closed: false },
      saturday: { open: '09:00', close: '22:00', closed: false },
      sunday: { open: '10:00', close: '20:00', closed: false },
    };
  });

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      name: '',
      restaurant_type: 'restaurant',
      description: '',
      country: 'US',
      address: '',
      location_lat: '',
      location_lng: '',
      phone: '',
      website: '',
      delivery_available: true,
      takeout_available: true,
      dine_in_available: true,
      service_speed: 'regular',
      accepts_reservations: false,
    },
  });

  // Load saved data
  useEffect(() => {
    if (!user?.id) return;

    const savedData = loadRestaurantData(user.id);
    if (savedData) {
      if (savedData.basicInfo) {
        setValue('name', savedData.basicInfo.name || '');
        setValue('restaurant_type', savedData.basicInfo.restaurant_type || 'restaurant');
        setValue('description', savedData.basicInfo.description || '');
        setValue('country', savedData.basicInfo.country || 'US');
        setValue('address', savedData.basicInfo.address || '');
        setValue('location_lat', savedData.basicInfo.location?.lat?.toString() || '');
        setValue('location_lng', savedData.basicInfo.location?.lng?.toString() || '');
        setValue('phone', savedData.basicInfo.phone || '');
        setValue('website', savedData.basicInfo.website || '');
      }
      if (savedData.operations) {
        setValue('delivery_available', savedData.operations.delivery_available ?? true);
        setValue('takeout_available', savedData.operations.takeout_available ?? true);
        setValue('dine_in_available', savedData.operations.dine_in_available ?? true);
        setValue('service_speed', savedData.operations.service_speed || 'regular');
        setValue('accepts_reservations', savedData.operations.accepts_reservations ?? false);
      }
    }
  }, [user?.id, setValue]);

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
    setValue('location_lat', lat.toString());
    setValue('location_lng', lng.toString());
    setMapCoordinates({ lat, lng });
    toast.success('Location marked on map!');
  };

  const onSubmit = (data: FormData) => {
    // Validate required fields
    if (!data.name || !data.address) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (selectedCuisines.length === 0) {
      toast.error('Please select at least one cuisine type');
      return;
    }

    // Build operating hours (exclude closed days)
    const operating_hours: Record<string, { open: string; close: string }> = {};
    Object.entries(operatingHours).forEach(([day, hours]) => {
      if (!hours.closed) {
        operating_hours[day] = {
          open: hours.open,
          close: hours.close,
        };
      }
    });

    const basicInfo: Partial<RestaurantBasicInfo> = {
      name: data.name,
      restaurant_type: data.restaurant_type as RestaurantType,
      description: data.description || undefined,
      country: data.country,
      address: data.address,
      location: {
        lat: parseFloat(data.location_lat) || 0,
        lng: parseFloat(data.location_lng) || 0,
      },
      phone: data.phone || undefined,
      website: data.website || undefined,
      cuisines: selectedCuisines,
    };

    const operations: Partial<RestaurantOperations> = {
      operating_hours,
      delivery_available: data.delivery_available,
      takeout_available: data.takeout_available,
      dine_in_available: data.dine_in_available,
      service_speed: data.service_speed,
      accepts_reservations: data.accepts_reservations,
    };

    // Save to localStorage
    if (!user?.id) {
      toast.error('User not authenticated');
      return;
    }

    const savedData = loadRestaurantData(user.id);
    const updatedData: FormProgress = {
      basicInfo,
      operations,
      menus: savedData?.menus || [],
      dishes: savedData?.dishes || [],
      currentStep: 2,
    };

    saveRestaurantData(user.id, updatedData);
    toast.success('Restaurant information saved successfully!');

    // Navigate to review page for verification
    router.push('/onboard/review');
  };

  const handleBack = () => {
    router.push('/');
  };

  const filteredCuisines = CUISINES.filter(cuisine =>
    cuisine.toLowerCase().includes(cuisineSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-linear-to-br from-orange-50 to-red-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Button variant="ghost" onClick={handleBack} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">Restaurant Information</h1>
          <p className="text-gray-600 mt-2">Provide essential information about your restaurant</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Utensils className="h-5 w-5" />
                Basic Information
              </CardTitle>
              <CardDescription>General details about your restaurant</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name" className="mb-2 block">
                  Restaurant Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  {...register('name', { required: true })}
                  placeholder="e.g., The Golden Spoon"
                  className={errors.name ? 'border-red-500' : ''}
                />
              </div>

              <div>
                <Label htmlFor="restaurant_type" className="mb-2 block">
                  Restaurant Type <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={restaurantType}
                  onValueChange={value => {
                    setRestaurantType(value);
                    setValue('restaurant_type', value);
                  }}
                >
                  <SelectTrigger className="w-full">
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

              <div>
                <Label htmlFor="phone" className="mb-2 block">
                  Phone Number
                </Label>
                <Input
                  id="phone"
                  {...register('phone')}
                  placeholder="+1 (555) 123-4567"
                  type="tel"
                />
              </div>

              <div>
                <Label htmlFor="website" className="mb-2 block">
                  Website
                </Label>
                <Input
                  id="website"
                  {...register('website', {
                    validate: value => {
                      if (!value || value.trim() === '') return true; // Optional field
                      // Allow domain formats like: example.com, subdomain.example.com, example.co.uk
                      // Without requiring http:// or www
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
                  <p className="text-sm text-red-500 mt-1">{errors.website.message}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Location */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Location
              </CardTitle>
              <CardDescription>Where can customers find you?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="country" className="mb-2 block">
                  Country <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={country}
                  onValueChange={value => {
                    setCountry(value);
                    setValue('country', value);
                  }}
                >
                  <SelectTrigger className="w-full">
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
                <Label htmlFor="address" className="mb-2 block">
                  Full Address <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="address"
                  {...register('address', { required: true })}
                  placeholder="123 Main Street, City, State, ZIP"
                  className={errors.address ? 'border-red-500' : ''}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="location_lat" className="mb-2 block">
                    Latitude
                  </Label>
                  <Input
                    id="location_lat"
                    {...register('location_lat')}
                    placeholder="40.7128"
                    type="number"
                    step="any"
                    readOnly
                  />
                </div>
                <div>
                  <Label htmlFor="location_lng" className="mb-2 block">
                    Longitude
                  </Label>
                  <Input
                    id="location_lng"
                    {...register('location_lng')}
                    placeholder="-74.0060"
                    type="number"
                    step="any"
                    readOnly
                  />
                </div>
              </div>

              <p className="text-sm text-gray-500">
                Click on the map below to mark your restaurant location and get coordinates
                automatically.
              </p>

              <LocationPicker
                initialLat={mapCoordinates?.lat}
                initialLng={mapCoordinates?.lng}
                onLocationSelect={handleLocationSelect}
              />
            </CardContent>
          </Card>

          {/* Cuisines */}
          <Card>
            <CardHeader>
              <CardTitle>
                Cuisine Types <span className="text-red-500">*</span>
              </CardTitle>
              <CardDescription>Select all cuisines that apply to your restaurant</CardDescription>
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
                <Clock className="h-5 w-5" />
                Operating Hours
              </CardTitle>
              <CardDescription>When are you open for business?</CardDescription>
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
                    setServiceSpeed(value as 'fast-food' | 'regular');
                    setValue('service_speed', value as 'fast-food' | 'regular');
                  }}
                >
                  {SERVICE_SPEED_OPTIONS.map(option => (
                    <div key={option.value} className="flex items-start space-x-3 mb-3">
                      <RadioGroupItem value={option.value} id={`speed-${option.value}`} />
                      <div className="flex-1">
                        <Label
                          htmlFor={`speed-${option.value}`}
                          className="font-medium cursor-pointer"
                        >
                          {option.label}
                        </Label>
                        <p className="text-sm text-gray-500">{option.description}</p>
                      </div>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-between pt-4">
            <Button type="button" variant="outline" onClick={handleBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
            <Button type="submit" size="lg" className="bg-orange-600 hover:bg-orange-700">
              Continue to Review
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function BasicInfoPage() {
  return (
    <ProtectedRoute>
      <BasicInfoPageContent />
    </ProtectedRoute>
  );
}
