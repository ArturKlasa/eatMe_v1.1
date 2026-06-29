import { NextRequest, NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@/lib/supabase/server';

type RouteHandlerClient = Awaited<ReturnType<typeof createRouteHandlerClient>>;

type RouteHandler<Params> = (
  ctx: { user: User; userId: string; supabase: RouteHandlerClient },
  req: NextRequest,
  routeParams: { params: Promise<Params> }
) => Promise<Response>;

export function withAdminAuthRoute<Params = Record<string, string>>(
  handler: RouteHandler<Params>
): (req: NextRequest, routeParams: { params: Promise<Params> }) => Promise<Response> {
  return async (req, routeParams) => {
    const supabase = await createRouteHandlerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
    }
    if (data.user.app_metadata?.role !== 'admin') {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }
    return handler({ user: data.user, userId: data.user.id, supabase }, req, routeParams);
  };
}
