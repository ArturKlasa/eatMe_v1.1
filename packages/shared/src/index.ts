/**
 * @eatme/shared
 *
 * Shared constants, domain types, and Zod validation schemas for the EatMe
 * monorepo. Consumed by both `apps/web-portal` and `apps/mobile` so that
 * canonical data (cuisine lists, dietary tags, restaurant types, etc.) is
 * defined once and never duplicated.
 *
 * Sub-modules:
 *   constants/  — Readonly arrays and lookup maps used in UI and validation
 *   types/      — Core domain interfaces (Dish, Menu, RestaurantData, …)
 *   validation/ — Zod schemas for the onboarding wizard forms
 */

export * from './constants';
export * from './types';
export * from './validation';
