import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

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
 */
export async function verifyAdminRequest(
  request: NextRequest
): Promise<
  | { user: { id: string; email?: string; user_metadata: Record<string, unknown> }; error: null }
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

  if (user.user_metadata?.role !== 'admin') {
    return { user: null, error: 'Admin access required', status: 403 };
  }

  return { user: user as any, error: null };
}
