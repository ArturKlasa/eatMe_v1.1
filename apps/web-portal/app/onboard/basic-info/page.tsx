'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, FormProvider } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { loadRestaurantData, saveRestaurantData } from '@/lib/storage';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import type { RestaurantBasicInfo, RestaurantOperations, FormProgress, RestaurantType, PaymentMethods } from '@/types/restaurant';
import { ArrowLeft, ArrowRight, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useRestaurantDraft, loadFormDefaults } from '@/lib/hooks/useRestaurantDraft';
import { BasicInfoFields } from '@/components/onboarding/BasicInfoFields';
import { ContactFields } from '@/components/onboarding/ContactFields';
import { LocationSection } from '@/components/onboarding/LocationSection';
import { ServiceOptionsSection } from '@/components/onboarding/ServiceOptionsSection';
import { AutoSaveIndicator } from '@/components/onboarding/AutoSaveIndicator';
import { OperatingHoursEditor } from '@/components/forms/OperatingHoursEditor';
import { CuisineSelector } from '@/components/forms/CuisineSelector';
import type { BasicInfoFormData } from '@/components/onboarding/types';

function BasicInfoPageContent() {
  const router = useRouter();
  const { user } = useAuth();
  const methods = useForm<BasicInfoFormData>({
    defaultValues: () => Promise.resolve(loadFormDefaults(user?.id)),
  });

  const selectedCuisinesRef = useRef<string[]>([]);
  const operatingHoursRef = useRef<Record<string, { open: string; close: string; closed: boolean }>>({});
  const { draftData, lastSaved, saving } = useRestaurantDraft({
    userId: user?.id, watch: methods.watch, selectedCuisinesRef, operatingHoursRef,
  });

  const [mapCoordinates, setMapCoordinates] = useState(draftData.mapCoordinates);
  const [selectedCuisines, setSelectedCuisines] = useState(draftData.selectedCuisines);
  const [restaurantType, setRestaurantType] = useState(draftData.restaurantType);
  const [country, setCountry] = useState(draftData.country);
  const [serviceSpeed, setServiceSpeed] = useState(draftData.serviceSpeed);
  const [paymentMethods, setPaymentMethods] = useState(draftData.paymentMethods);
  const [operatingHours, setOperatingHours] = useState(draftData.operatingHours);

  useEffect(() => { selectedCuisinesRef.current = selectedCuisines; }, [selectedCuisines]);
  useEffect(() => { operatingHoursRef.current = operatingHours; }, [operatingHours]);

  const onSubmit = (data: BasicInfoFormData) => {
    if (!data.name || !data.address) { toast.error('Please fill in all required fields'); return; }
    if (selectedCuisines.length === 0) { toast.error('Please select at least one cuisine type'); return; }
    if (!user?.id) { toast.error('User not authenticated'); return; }

    const operating_hours: Record<string, { open: string; close: string }> = {};
    Object.entries(operatingHours).forEach(([day, h]) => {
      if (!h.closed) operating_hours[day] = { open: h.open, close: h.close };
    });

    const basicInfo: Partial<RestaurantBasicInfo> = {
      name: data.name, restaurant_type: data.restaurant_type as RestaurantType,
      description: data.description || undefined, country: data.country,
      city: data.city || undefined, neighbourhood: data.neighbourhood || undefined,
      state: data.state || undefined, postal_code: data.postal_code || undefined,
      address: data.address,
      location: { lat: parseFloat(data.location_lat) || 0, lng: parseFloat(data.location_lng) || 0 },
      phone: data.phone || undefined, website: data.website || undefined,
      cuisines: selectedCuisines,
    };
    const operations: Partial<RestaurantOperations> = {
      operating_hours, delivery_available: data.delivery_available,
      takeout_available: data.takeout_available, dine_in_available: data.dine_in_available,
      service_speed: data.service_speed, accepts_reservations: data.accepts_reservations,
      payment_methods: data.payment_methods,
    };

    const savedData = loadRestaurantData(user.id);
    saveRestaurantData(user.id, {
      basicInfo, operations,
      menus: savedData?.menus || [], dishes: savedData?.dishes || [], currentStep: 2,
    } as FormProgress);
    toast.success('Restaurant information saved successfully!');
    router.push('/onboard/review');
  };

  const handleBack = () => router.push('/');

  return (
    <div className="min-h-screen bg-linear-to-br from-orange-50 to-red-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" onClick={handleBack}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
            </Button>
            <AutoSaveIndicator lastSaved={lastSaved} saving={saving} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Restaurant Information</h1>
          <p className="text-gray-600 mt-2">Provide essential information about your restaurant</p>
        </div>

        <FormProvider {...methods}>
          <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-6">
            <BasicInfoFields restaurantType={restaurantType} onRestaurantTypeChange={setRestaurantType} />

            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
                <CardDescription>How can customers reach you?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4"><ContactFields /></CardContent>
            </Card>

            <LocationSection
              mapCoordinates={mapCoordinates} onMapCoordinatesChange={setMapCoordinates}
              country={country} onCountryChange={setCountry}
            />

            <Card>
              <CardHeader>
                <CardTitle>Cuisine Types <span className="text-red-500">*</span></CardTitle>
                <CardDescription>Select all cuisines that apply to your restaurant</CardDescription>
              </CardHeader>
              <CardContent>
                <CuisineSelector selected={selectedCuisines} onChange={setSelectedCuisines} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" /> Operating Hours
                </CardTitle>
                <CardDescription>When are you open for business?</CardDescription>
              </CardHeader>
              <CardContent>
                <OperatingHoursEditor value={operatingHours} onChange={setOperatingHours} />
              </CardContent>
            </Card>

            <ServiceOptionsSection
              serviceSpeed={serviceSpeed} onServiceSpeedChange={setServiceSpeed}
              paymentMethods={paymentMethods} onPaymentMethodsChange={setPaymentMethods}
            />

            <div className="flex justify-between pt-4">
              <Button type="button" variant="outline" onClick={handleBack}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
              </Button>
              <Button type="submit" size="lg" className="bg-orange-600 hover:bg-orange-700">
                Continue to Review <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </form>
        </FormProvider>
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
