import { z } from 'zod';

export const menuCreateSchemaV2 = z.object({
  name: z.string().min(1, 'Menu name is required'),
  description: z.string().optional().or(z.literal('')),
  menu_type: z.enum(['food', 'drink']).default('food'),
});
export type MenuCreateInput = z.input<typeof menuCreateSchemaV2>;

export const menuUpdateSchemaV2 = z.object({
  name: z.string().min(1, 'Menu name is required').optional(),
  description: z.string().optional().or(z.literal('')),
  menu_type: z.enum(['food', 'drink']).optional(),
});
export type MenuUpdateInput = z.infer<typeof menuUpdateSchemaV2>;

export const menuCategoryCreateSchemaV2 = z.object({
  menu_id: z.string().uuid('Invalid menu ID'),
  name: z.string().min(1, 'Category name is required'),
  description: z.string().optional().or(z.literal('')),
});
export type MenuCategoryCreateInput = z.infer<typeof menuCategoryCreateSchemaV2>;

export const menuCategoryUpdateSchemaV2 = z.object({
  name: z.string().min(1, 'Category name is required').optional(),
  description: z.string().optional().or(z.literal('')),
});
export type MenuCategoryUpdateInput = z.infer<typeof menuCategoryUpdateSchemaV2>;
