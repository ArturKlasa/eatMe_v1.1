import type { User } from '@supabase/supabase-js';
import { createServerActionClient } from '@/lib/supabase/server';

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; formError?: string; fieldErrors?: Record<string, string[]> };

type SupabaseClient = Awaited<ReturnType<typeof createServerActionClient>>;

export type AuthCtx = {
  user: User;
  userId: string;
  supabase: SupabaseClient;
};

export function withAuth<Args extends unknown[], R>(
  handler: (ctx: AuthCtx, ...args: Args) => Promise<ActionResult<R>>
): (...args: Args) => Promise<ActionResult<R>> {
  return async (...args) => {
    const supabase = await createServerActionClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return { ok: false, formError: 'UNAUTHENTICATED' };
    }
    return handler({ user: data.user, userId: data.user.id, supabase }, ...args);
  };
}

export function withAdminAuth<Args extends unknown[], R>(
  handler: (ctx: AuthCtx, ...args: Args) => Promise<ActionResult<R>>
): (...args: Args) => Promise<ActionResult<R>> {
  return async (...args) => {
    const supabase = await createServerActionClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return { ok: false, formError: 'UNAUTHENTICATED' };
    if (data.user.app_metadata?.role !== 'admin') {
      return { ok: false, formError: 'FORBIDDEN' };
    }
    return handler({ user: data.user, userId: data.user.id, supabase }, ...args);
  };
}

export function withPublic<Args extends unknown[], R>(
  handler: (ctx: { supabase: SupabaseClient }, ...args: Args) => Promise<ActionResult<R>>
): (...args: Args) => Promise<ActionResult<R>> {
  return async (...args) => {
    const supabase = await createServerActionClient();
    return handler({ supabase }, ...args);
  };
}
