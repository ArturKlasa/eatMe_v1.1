import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import type { Database } from '@eatme/database';

/**
 * Cookie-based Supabase client for Server Components and Route Handlers.
 *
 * Reads/writes the session via HTTP cookies so the server (and proxy) can
 * verify authentication without touching localStorage.
 *
 * Do NOT use in Client Components — import `supabase` from `@/lib/supabase`.
 */
export async function createSupabaseSessionClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — cookie writes are a no-op.
            // The proxy refreshes the session cookie on every request.
          }
        },
      },
    }
  );
}

/**
 * Creates a Supabase client for use inside proxy.ts.
 *
 * Reads the session from request cookies and writes any refreshed tokens
 * back to the response cookies, keeping the session alive transparently.
 */
export function createMiddlewareClient(request: NextRequest, response: NextResponse) {
  const client = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );
  return { client, response };
}

/**
 * Creates a Supabase admin client using the service role key.
 * Use ONLY in server-side API routes — never expose to the client.
 * Service role bypasses all RLS policies.
 */
export function createServerSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'Missing server Supabase environment variables.\n' +
        'Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local'
    );
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Extracts and verifies the Bearer token from an API request.
 * Returns the authenticated user if the token is valid AND the user is an admin.
 *
 * Checks app_metadata.role (service-role-only, not editable by end users).
 */
export async function verifyAdminRequest(
  request: NextRequest
): Promise<
  | { user: { id: string; email?: string; app_metadata: Record<string, unknown> }; error: null }
  | { user: null; error: string; status: 401 | 403 }
> {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '').trim();

  if (!token) {
    return { user: null, error: 'Missing authorization header', status: 401 };
  }

  const supabase = createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { user: null, error: 'Invalid or expired token', status: 401 };
  }

  if (user.app_metadata?.role !== 'admin') {
    return { user: null, error: 'Admin access required', status: 403 };
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      app_metadata: user.app_metadata,
    },
    error: null,
  };
}
