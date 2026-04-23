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
  /** Paths requiring admin role — non-admins are redirected to forbiddenPath. */
  adminOnly?: string[];
  /** Sign-in page path. Unauthenticated appRoute visitors get `signinPath?redirect=<pathname>`. Defaults to '/signin'. */
  signinPath?: string;
  /** Redirect target for non-admin visitors hitting adminOnly routes. Defaults to '/signin?forbidden=1'. */
  forbiddenPath?: string;
  /** Post-auth redirect for authenticated visitors hitting authRoutes. Defaults to '/restaurant'. */
  postAuthPath?: string;
  /** NextResponse factory from `next/server` — injected to avoid a `next` peer dependency. */
  NextResponse: NextResponseFactory;
}

/**
 * Shared auth proxy factory. Returns a proxy handler that:
 * 1. Refreshes the Supabase session cookie.
 * 2. Redirects unauthenticated requests for appRoutes to signinPath.
 * 3. Redirects authenticated requests for authRoutes away to postAuthPath.
 * 4. Redirects non-admin requests for adminOnly routes to forbiddenPath.
 */
export function createAuthProxy(config: AuthProxyConfig) {
  const {
    url,
    anonKey,
    appRoutes,
    authRoutes,
    adminOnly = [],
    signinPath = '/signin',
    forbiddenPath = '/signin?forbidden=1',
    postAuthPath = '/restaurant',
    NextResponse,
  } = config;

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
        new URL(signinPath + '?redirect=' + encodeURIComponent(pathname), req.url)
      );
    }

    if (adminOnly.some(r => pathname.startsWith(r)) && user?.app_metadata?.role !== 'admin') {
      return NextResponse.redirect(new URL(forbiddenPath, req.url));
    }

    if (authRoutes.some(r => pathname.startsWith(r)) && user) {
      return NextResponse.redirect(new URL(postAuthPath, req.url));
    }

    return supabaseResponse;
  };
}
