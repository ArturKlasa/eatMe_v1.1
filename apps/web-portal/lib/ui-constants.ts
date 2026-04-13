export interface ColorVariant {
  bg: string;
  text: string;
}

export interface StatusConfig {
  icon: string;
  bg: string;
  text: string;
  label: string;
}

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

export const INGREDIENT_FAMILY_COLORS: Record<string, ColorVariant> = {
  fish: { bg: 'bg-blue-100', text: 'text-blue-800' },
  shellfish: { bg: 'bg-cyan-100', text: 'text-cyan-800' },
  meat: { bg: 'bg-red-100', text: 'text-red-800' },
  poultry: { bg: 'bg-orange-100', text: 'text-orange-800' },
  dairy: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  eggs: { bg: 'bg-amber-100', text: 'text-amber-800' },
  plant_milk: { bg: 'bg-lime-100', text: 'text-lime-800' },
  vegetable: { bg: 'bg-green-100', text: 'text-green-800' },
  fruit: { bg: 'bg-pink-100', text: 'text-pink-800' },
  grain: { bg: 'bg-stone-100', text: 'text-stone-800' },
  plant_protein: { bg: 'bg-teal-100', text: 'text-teal-800' },
  nut_seed: { bg: 'bg-brown-100', text: 'text-yellow-900' },
  spice_herb: { bg: 'bg-purple-100', text: 'text-purple-800' },
  oil_fat: { bg: 'bg-yellow-50', text: 'text-yellow-700' },
  condiment: { bg: 'bg-rose-100', text: 'text-rose-800' },
  sweetener: { bg: 'bg-fuchsia-100', text: 'text-fuchsia-800' },
  beverage: { bg: 'bg-sky-100', text: 'text-sky-800' },
  alcohol: { bg: 'bg-violet-100', text: 'text-violet-800' },
  baking: { bg: 'bg-orange-50', text: 'text-orange-700' },
  other: { bg: 'bg-gray-100', text: 'text-gray-600' },
};

export const DIETARY_TAG_COLORS: Record<string, string> = {
  diet: 'bg-green-100 text-green-800 border-green-200',
  religious: 'bg-purple-100 text-purple-800 border-purple-200',
  health: 'bg-blue-100 text-blue-800 border-blue-200',
  lifestyle: 'bg-orange-100 text-orange-800 border-orange-200',
};

export const DIETARY_TAG_COLOR_DEFAULT = 'bg-gray-100 text-gray-800 border-gray-200';

export const STATUS_VARIANTS: Record<string, StatusConfig> = {
  active: {
    icon: 'CheckCircle',
    bg: 'bg-green-100',
    text: 'text-green-800',
    label: 'Active',
  },
  suspended: {
    icon: 'Ban',
    bg: 'bg-red-100',
    text: 'text-red-800',
    label: 'Suspended',
  },
  pending: {
    icon: 'Clock',
    bg: 'bg-yellow-100',
    text: 'text-yellow-800',
    label: 'Pending',
  },
};

export const SPICE_LEVEL_CONFIG = [
  { value: 'none' as const, label: 'No spice', icon: '' },
  { value: 'mild' as const, label: '\u{1F336}\u{FE0F}', icon: '\u{1F336}\u{FE0F}' },
  {
    value: 'hot' as const,
    label: '\u{1F336}\u{FE0F}\u{1F336}\u{FE0F}\u{1F336}\u{FE0F}',
    icon: '\u{1F336}\u{FE0F}\u{1F336}\u{FE0F}\u{1F336}\u{FE0F}',
  },
] as const;
