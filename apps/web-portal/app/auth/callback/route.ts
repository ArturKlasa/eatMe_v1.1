import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseSessionClient } from '@/lib/supabase-server';

/**
 * PKCE OAuth callback Route Handler.
 *
 * Supabase redirects here after OAuth consent with ?code=<pkce_code>.
 * This handler exchanges the code for a session and sets it in cookies.
 * The proxy then reads the cookie on subsequent requests to verify auth.
 *
 * Replaces the old client-side /auth/callback/page.tsx which parsed hash
 * tokens from the deprecated implicit flow.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (!code) {
    console.error('[Auth callback] Missing PKCE code in request');
    return NextResponse.redirect(`${origin}/auth/login?error=missing_code`);
  }

  const supabase = await createSupabaseSessionClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    console.error('[Auth callback] Code exchange failed:', error?.message);
    return NextResponse.redirect(`${origin}/auth/login?error=callback_failed`);
  }

  const role = data.session.user.user_metadata?.role;
  const destination = role === 'admin' ? '/admin' : next === '/' ? '/' : next;

  return NextResponse.redirect(`${origin}${destination}`);
}
