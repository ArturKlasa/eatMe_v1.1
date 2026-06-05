import { z } from 'zod';
import { PRIMARY_PROTEINS } from '@eatme/shared';

// Modifier-group + option Zod schemas. Lifted out of
// `app/(admin)/restaurants/[id]/actions/dish.ts` so both the server action AND
// the client-side adapter test can import them. Inferring `ApiGroupPayload` via
// `z.infer<typeof modifierGroupSchema>` in adapters.ts keeps the wire shape and
// the validator in lockstep — no hand-maintained duplicate.

export const modifierOptionSchema = z.object({
  name: z.string().min(1).max(200),
  price_delta: z.number().default(0),
  price_override: z.number().nonnegative().nullable().optional(),
  primary_protein: z.enum(PRIMARY_PROTEINS).nullable().optional(),
  serves_delta: z.number().int().default(0),
  is_default: z.boolean().default(false),
});

export const modifierGroupSchema = z.object({
  name: z.string().min(1).max(200),
  selection_type: z.enum(['single', 'multiple']),
  min_selections: z.number().int().min(0).default(0),
  max_selections: z.number().int().min(1).default(1),
  display_in_card: z.boolean().default(false),
  options: z.array(modifierOptionSchema).max(50).default([]),
});
