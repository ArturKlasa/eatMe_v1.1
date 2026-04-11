import type { LocationData } from '@/components/LocationFormSection';

export type { LocationData };

export interface BasicInfoFormData {
  name: string;
  restaurant_type: string;
  description: string;
  location: LocationData;
  phone: string;
  website: string;
  delivery_available: boolean;
  takeout_available: boolean;
  dine_in_available: boolean;
  service_speed?: 'fast-food' | 'regular';
  accepts_reservations: boolean;
  payment_methods: 'cash_only' | 'card_only' | 'cash_and_card';
}
