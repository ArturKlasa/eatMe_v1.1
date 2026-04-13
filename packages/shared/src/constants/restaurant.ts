type RestaurantType =
  | 'restaurant'
  | 'cafe'
  | 'food_truck'
  | 'food_stall'
  | 'bakery'
  | 'buffet'
  | 'fine_dining'
  | 'self_service'
  | 'ghost_kitchen'
  | 'other';

/** All restaurant venue types backed by the `restaurant_type` DB enum. */
export const RESTAURANT_TYPES: { value: RestaurantType; label: string; description: string }[] = [
  { value: 'restaurant', label: 'Restaurant', description: 'Full-service dining establishment' },
  { value: 'fine_dining', label: 'Fine Dining', description: 'Upscale, formal dining experience' },
  {
    value: 'self_service',
    label: 'Self-Service Restaurant',
    description: 'Self-service dining establishment',
  },
  { value: 'cafe', label: 'Café', description: 'Coffee shop or small eatery' },
  { value: 'food_truck', label: 'Food Truck', description: 'Mobile food service vehicle' },
  { value: 'food_stall', label: 'Food Stall', description: 'Street food or market stall' },
  { value: 'bakery', label: 'Bakery', description: 'Baked goods specialist' },
  { value: 'buffet', label: 'Buffet', description: 'All-you-can-eat style' },
  { value: 'ghost_kitchen', label: 'Ghost Kitchen', description: 'Delivery-only kitchen' },
  { value: 'other', label: 'Other', description: 'Other type of food establishment' },
];

/** Service-speed options (maps to `service_speed` DB column). */
export const SERVICE_SPEED_OPTIONS = [
  { value: 'regular', label: 'Regular Restaurant', description: 'Standard preparation time' },
  { value: 'fast-food', label: 'Fast Food', description: 'Food ready immediately' },
];

/** Accepted payment method options displayed on the operations form. */
export const PAYMENT_METHOD_OPTIONS = [
  {
    value: 'cash_and_card',
    label: 'Cash & Card',
    description: 'Accepts both cash and card payments',
    icon: '💵💳',
  },
  {
    value: 'card_only',
    label: 'Card Only',
    description: 'Card payments only (no cash)',
    icon: '💳',
  },
  {
    value: 'cash_only',
    label: 'Cash Only',
    description: 'Cash payments only (no cards)',
    icon: '💵',
  },
] as const;

/** Union of valid payment method string values. */
export type PaymentMethodValue = 'cash_and_card' | 'card_only' | 'cash_only';

/** Supported countries for phone-number and address validation. */
export const COUNTRIES = [
  { value: 'US', label: 'United States' },
  { value: 'CA', label: 'Canada' },
  { value: 'MX', label: 'Mexico' },
  { value: 'PL', label: 'Poland' },
];
