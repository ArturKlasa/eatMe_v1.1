import { NextRequest, NextResponse } from 'next/server';
import { createMiddlewareClient } from '@/lib/supabase-server';

/**
 * Next.js Proxy (replaces the deprecated "middleware" file convention).
 *
 * Responsibilities:
 * 1. Refresh the Supabase session cookie on every request (keeps session alive)
 * 2. Block unauthenticated requests to /onboard/* → redirect to /auth/login
 * 3. Block non-admin requests to /admin/* → redirect based on role
 * 4. Add security headers to sensitive routes
 *
 * Auth flow: PKCE (via @supabase/ssr createBrowserClient in lib/supabase.ts).
 * Session lives in cookies — readable here at the edge.
 */
export async function proxy(req: NextRequest) {
  // Start with a pass-through response so we can attach updated cookies
  let response = NextResponse.next({ request: req });

  const { client, response: updatedResponse } = createMiddlewareClient(req, response);
  response = updatedResponse;

  // Refresh session — writes updated tokens to cookies if the access token expired
  const {
    data: { user },
  } = await client.auth.getUser();

  const path = req.nextUrl.pathname;

  // ── Protected: /onboard/* ─────────────────────────────────────────────────
  if (path.startsWith('/onboard')) {
    if (!user) {
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = '/auth/login';
      loginUrl.searchParams.set('redirect', path);
      return NextResponse.redirect(loginUrl);
    }
  }

  // ── Protected: /admin/* ───────────────────────────────────────────────────
  if (path.startsWith('/admin')) {
    if (!user) {
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = '/auth/login';
      loginUrl.searchParams.set('error', 'unauthorized');
      loginUrl.searchParams.set('redirect', path);
      return NextResponse.redirect(loginUrl);
    }

    if (user.user_metadata?.role !== 'admin') {
      const homeUrl = req.nextUrl.clone();
      homeUrl.pathname = '/';
      homeUrl.searchParams.set('error', 'admin_only');
      return NextResponse.redirect(homeUrl);
    }
  }

  // ── Security headers — applied globally ──────────────────────────────────
  // X-Frame-Options is kept for legacy browser compatibility alongside
  // the CSP frame-ancestors directive.
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      // 'unsafe-inline' is required by Next.js App Router for hydration scripts.
      // 'unsafe-eval' has been intentionally removed — it is only needed by
      // certain bundler dev modes and is not required in production.
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://nominatim.openstreetmap.org https://api.mapbox.com https://events.mapbox.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      'upgrade-insecure-requests',
    ].join('; ')
  );

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static  (static assets)
     * - _next/image   (image optimisation)
     * - favicon.ico
     * - public images/fonts
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
