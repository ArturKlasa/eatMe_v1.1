/** Dollar-sign price-tier indicators used in filter and display UI. */
export const PRICE_RANGES = ['$', '$$', '$$$', '$$$$'] as const;

/** Spice level options (maps to the `spice_level` DB enum). */
export const SPICE_LEVELS = [
  { value: 'none' as const, label: 'No spice', icon: '' },
  { value: 'mild' as const, label: '🌶️', icon: '🌶️' },
  { value: 'hot' as const, label: '🌶️🌶️🌶️', icon: '🌶️🌶️🌶️' },
] as const;

/** Union of valid spice level string values. */
export type SpiceLevel = (typeof SPICE_LEVELS)[number]['value'];

/** How the dish price is labelled on the menu (exact, from, per-person, etc.). */
export const DISPLAY_PRICE_PREFIXES = [
  { value: 'exact' as const, label: 'Exact price', example: '$14.00' },
  { value: 'from' as const, label: 'From', example: 'from $14.00' },
  { value: 'per_person' as const, label: 'Per person', example: '$14.00 / person' },
  { value: 'market_price' as const, label: 'Market price', example: 'Market price' },
  { value: 'ask_server' as const, label: 'Ask server', example: 'Ask server' },
] as const;

/** Union of valid display price prefix string values. */
export type DisplayPricePrefixValue = (typeof DISPLAY_PRICE_PREFIXES)[number]['value'];
