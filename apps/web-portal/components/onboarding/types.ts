export interface BasicInfoFormData {
  name: string;
  restaurant_type: string;
  description: string;
  country: string;
  city: string;
  neighbourhood: string;
  state: string;
  postal_code: string;
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
  payment_methods: 'cash_only' | 'card_only' | 'cash_and_card';
}
