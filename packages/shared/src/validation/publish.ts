import { z } from 'zod';

export const publishPayloadSchema = z.object({
  restaurant_id: z.string().uuid(),
});

export type PublishPayload = z.infer<typeof publishPayloadSchema>;
