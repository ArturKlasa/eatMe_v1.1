import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * SECURITY: Middleware for security headers
 *
 * NOTE: Auth checks moved to client-side admin layout due to
 * local dev cookie propagation issues with OAuth. RLS still
 * enforces data access at the database level.
 */

export async function middleware(req: NextRequest) {
  const response = NextResponse.next({
    request: req,
  });

  const path = req.nextUrl.pathname;

  if (path.startsWith('/admin')) {
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co;"
    );
  }

  return response;
}

/**
 * SECURITY: Configure which routes this middleware applies to
 *
 * Matcher ensures middleware only runs on necessary routes
 * This improves performance and reduces attack surface
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
