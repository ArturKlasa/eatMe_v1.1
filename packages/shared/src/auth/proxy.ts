import { createServerClient } from '@supabase/ssr';

/** Minimal structural types compatible with NextRequest / NextResponse via structural typing. */
export interface AuthProxyRequest {
  url: string;
  nextUrl: { pathname: string };
  cookies: {
    getAll(): Array<{ name: string; value: string }>;
  };
  headers: Headers;
}

/** A response that supports cookie writes — structurally compatible with NextResponse. */
export interface AuthProxyResponseLike {
  cookies: {
    set(name: string, value: string, options?: Record<string, unknown>): void;
  };
}

/** Factory interface for creating pass-through or redirect responses. */
export interface NextResponseFactory {
  next(opts?: { request?: { headers?: Headers } }): AuthProxyResponseLike & Response;
  redirect(url: string | URL, status?: number): Response;
}

export interface AuthProxyConfig {
  url: string;
  anonKey: string;
  /** Paths requiring authentication — unauthenticated visitors are redirected to /signin. */
  appRoutes: string[];
  /** Login/signup paths — authenticated visitors are redirected away. */
  authRoutes: string[];
  /** Paths requiring admin role — non-admins are redirected to /signin?forbidden=1. */
  adminOnly?: string[];
  /** NextResponse factory from `next/server` — injected to avoid a `next` peer dependency. */
  NextResponse: NextResponseFactory;
}

/**
 * Shared auth proxy factory. Returns a proxy handler that:
 * 1. Refreshes the Supabase session cookie.
 * 2. Redirects unauthenticated requests for appRoutes to /signin.
 * 3. Redirects authenticated requests for authRoutes away to /restaurant.
 * 4. Redirects non-admin requests for adminOnly routes to /signin?forbidden=1.
 */
export function createAuthProxy(config: AuthProxyConfig) {
  const { url, anonKey, appRoutes, authRoutes, adminOnly = [], NextResponse } = config;

  return async (req: AuthProxyRequest): Promise<Response> => {
    const supabaseResponse = NextResponse.next({ request: { headers: req.headers } });

    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options as Record<string, unknown>);
          });
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { pathname } = req.nextUrl;

    if (appRoutes.some(r => pathname.startsWith(r)) && !user) {
      return NextResponse.redirect(
        new URL('/signin?redirect=' + encodeURIComponent(pathname), req.url)
      );
    }

    if (adminOnly.some(r => pathname.startsWith(r)) && user?.app_metadata?.role !== 'admin') {
      return NextResponse.redirect(new URL('/signin?forbidden=1', req.url));
    }

    if (authRoutes.some(r => pathname.startsWith(r)) && user) {
      return NextResponse.redirect(new URL('/restaurant', req.url));
    }

    return supabaseResponse;
  };
}
