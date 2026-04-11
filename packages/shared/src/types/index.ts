/**
 * Shared Domain Types
 *
 * Core TypeScript interfaces and type aliases shared between mobile and
 * web-portal. These model the EatMe data layer: restaurants, menus, dishes,
 * ingredients, and the onboarding wizard state.
 *
 * All types are re-exported from `@eatme/shared` directly — consumers should
 * `import type { Dish, Menu } from '@eatme/shared'`.
 */

export type {
  Location,
  Ingredient,
  SelectedIngredient,
  DishKind,
  ScheduleType,
  DisplayPricePrefix,
  Option,
  OptionGroup,
  OperatingHours,
  DishCategory,
  Dish,
  Menu,
  RestaurantType,
  RestaurantBasicInfo,
  PaymentMethods,
  RestaurantOperations,
  RestaurantData,
  WizardStep,
  FormProgress,
} from './restaurant';
