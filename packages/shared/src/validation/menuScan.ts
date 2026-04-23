import { z } from 'zod';
import { PRIMARY_PROTEINS } from '../logic/protein';

const primaryProteinEnum = z.enum(
  PRIMARY_PROTEINS as readonly [string, ...string[]] as [string, ...string[]]
);

export const menuScanJobInputSchema = z.object({
  images: z
    .array(
      z.object({
        bucket: z.string(),
        path: z.string(),
        page: z.number().int().min(1),
      })
    )
    .min(1)
    .max(20),
});

export type MenuScanJobInput = z.infer<typeof menuScanJobInputSchema>;

export const confirmMenuScanPayloadSchema = z.object({
  job_id: z.string().uuid(),
  idempotency_key: z.string().min(10),
  dishes: z.array(
    z.object({
      menu_category_id: z.string().uuid(),
      name: z.string().min(1),
      description: z.string().nullable().optional(),
      price: z.number().nonnegative(),
      dish_kind: z.enum(['standard', 'bundle', 'configurable', 'course_menu', 'buffet']),
      primary_protein: primaryProteinEnum,
      is_template: z.boolean().default(false),
    })
  ),
});

export type ConfirmMenuScanPayload = z.infer<typeof confirmMenuScanPayloadSchema>;
