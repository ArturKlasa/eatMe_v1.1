/**
 * Shared Zod Validation Schemas
 *
 * Schemas for the restaurant partner onboarding wizard, shared between
 * web-portal (React Hook Form) and any future consumers.
 *
 * Each schema maps to a wizard step:
 *   basicInfoSchema      — identity, address, cuisines
 *   operationsSchema     — hours, services, payment methods
 *   dishSchema           — individual dish definition
 *   menuSchema           — full menu (array of dishes)
 *   restaurantDataSchema — final review payload (restaurant + dishes merged)
 *
 * Inferred types (BasicInfoFormData, etc.) are the canonical form-data
 * types used with React Hook Form throughout the onboarding pages.
 */

export {
  basicInfoSchema,
  operationsSchema,
  dishSchema,
  menuSchema,
  restaurantDataSchema,
} from './restaurant';

export type {
  BasicInfoFormData,
  OperationsFormData,
  DishFormData,
  MenuFormData,
  RestaurantDataFormData,
} from './restaurant';
