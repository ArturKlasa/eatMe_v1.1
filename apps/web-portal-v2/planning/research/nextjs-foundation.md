# Next.js 16 Foundation — EatMe Web Portal v2

Research doc seeding the v2 design. Locked stack (per rough-idea + user): Next.js 16 + React 19, App Router, Server Actions, Supabase (raw client + generated types), TanStack Query, Tailwind v4 + shadcn/ui, react-hook-form + Zod. Two apps: `apps/web-portal-v2/` (owner) and `apps/admin/`. No Drizzle/Kysely. No Zustand.

> Citations reference upstream docs fetched 2026-04-23. Where a shape is a sketch, the doc says so. All signatures must be confirmed against live `@supabase/ssr` and `next@16.2.x` types before lock.

---

## 1. Next.js 16 status check

**GA: yes.** Next.js 16.0 shipped 2025-10-21; current stable is **16.2.x** (released 2026-03-18). ([Next.js 16 blog](https://nextjs.org/blog/next-16), [Next.js 16.2 blog](https://nextjs.org/blog/next-16-2))

### Version requirements

| Tool | Minimum |
|---|---|
| Node.js | 20.9 LTS (Node 18 dropped) |
| TypeScript | 5.1 |
| React | React 19 canary / 19.2 features (App Router pins its own React) |
| Browsers | Chrome/Edge/Firefox 111+, Safari 16.4+ |

React 19 is **effectively required** for App Router — the App Router in Next.js 16 ships its own React Canary that includes 19.2 features (View Transitions, `useEffectEvent`, `<Activity/>`). You don't opt in; using App Router means you're on it. ([breaking changes table](https://nextjs.org/blog/next-16#version-requirements))

### Changes vs Next.js 15 that affect v2

| Change | Impact on v2 |
|---|---|
| **`middleware.ts` → `proxy.ts`** (renamed; old name deprecated, still works but will be removed) | v2 uses `proxy.ts`. File the v1 review said had a "wrong name" is actually the Next.js 16 convention — but v1's was dead because Next.js 15 didn't recognise it. |
| **Async `params`, `searchParams`, `cookies()`, `headers()`, `draftMode()`** | All `await`-ed. Codegen templates must reflect this. |
| **Cache Components + `use cache`** (opt-in via `cacheComponents: true`) | Not adopting in v2 foundation. Default dynamic rendering keeps the draft/published mental model simple. Re-evaluate once stable. |
| **`revalidateTag(tag)` now requires a `cacheLife` profile** as 2nd arg for SWR | Relevant for the feed/menu cache invalidations. |
| **`updateTag(tag)`** new — Server-Action-only, read-your-writes | The right primitive for draft→published transitions. |
| **`refresh()`** new — Server-Action-only, refreshes uncached data | Good fit for menu-scan job status updates not backed by cache tags. |
| **Turbopack default** (`next dev`, `next build`) | No config required. `transpilePackages` still works. |
| **React Compiler support stable** (opt-in via `reactCompiler: true`) | Skip for v2.0; reconsider once we have a perf baseline. |
| **Parallel routes require `default.js`** | Builds fail without it. Scaffold templates must include `default.tsx`. |
| **`images.domains` deprecated** → `images.remotePatterns` | Use `remotePatterns` from day one. |
| **`images.qualities` default now `[75]`** | Consumer-app photos rendered in portal previews: set `quality={75}` explicitly. |
| **`next lint` removed** | Run ESLint directly (or Biome). `next build` no longer lints. CI must lint as a separate step. |
| **Sync `cookies()`/`headers()`** | `const c = await cookies()` everywhere. |
| **`transpilePackages` unchanged** | Continues to work with Turbopack; list `@eatme/shared`, `@eatme/database`, `@eatme/tokens`. ([docs](https://nextjs.org/docs/app/api-reference/config/next-config-js/transpilePackages)) |

### Gotchas specifically for this project

1. **`proxy.ts` runs on Node.js runtime by default.** This is a change in intent from Next 15 middleware (which was Edge). No more "Edge-only crypto" pain. `@supabase/ssr` works in proxy.ts without polyfills. ([release notes](https://nextjs.org/blog/next-16#proxyts-formerly-middlewarets))
2. **`middleware.ts` is still accepted for Edge-only workflows but deprecated.** v2 uses `proxy.ts`. One file per app (monorepo → one per `apps/*`).
3. **"Proxy is not intended for slow data fetching… not a full session management or authorization solution."** ([docs](https://nextjs.org/docs/app/getting-started/proxy)) v2 uses proxy only for cookie refresh + optimistic redirects. The actual auth gate lives in Server Actions / Route Handlers / DAL (section 3).
4. **Node-native TypeScript for `next.config.ts`** requires the `--experimental-next-config-strip-types` flag. Stick with `next.config.ts` plus the normal TS toolchain for v2 — no experimental flags at foundation time.

---

## 2. App Router + Server Components + Server Actions conventions

### File conventions (what v2 uses)

```
apps/web-portal-v2/
├── proxy.ts                       # session refresh + optimistic redirects
├── next.config.ts
├── app/
│   ├── layout.tsx                 # root RSC layout, <Providers> wrapper
│   ├── page.tsx                   # public landing
│   ├── loading.tsx                # global fallback
│   ├── error.tsx                  # 'use client' — global error boundary
│   ├── not-found.tsx
│   ├── (marketing)/               # route group (no URL segment)
│   │   └── pricing/page.tsx
│   ├── (auth)/                    # auth pages grouped
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── (app)/                     # signed-in owner shell
│   │   ├── layout.tsx             # sidebar + topbar; calls verifySession()
│   │   ├── default.tsx            # required for parallel routes
│   │   ├── dashboard/page.tsx
│   │   ├── restaurants/[id]/
│   │   │   ├── page.tsx
│   │   │   ├── loading.tsx
│   │   │   ├── menu/page.tsx
│   │   │   └── scan/[jobId]/page.tsx
│   │   └── actions/               # colocated Server Actions
│   │       ├── restaurant.ts
│   │       ├── menu.ts
│   │       └── scan.ts
│   └── api/
│       └── webhooks/
│           └── scan-complete/route.ts
```

- **Route groups `(group)/`**: organise without affecting URL. Used here to isolate the auth shell from the app shell.
- **Parallel routes**: not expected for v2.0. If introduced (e.g. modal-in-URL for dish edit), every slot needs an explicit `default.tsx`. ([Next 16 breaking changes](https://nextjs.org/blog/next-16#behavior-changes))
- **`error.tsx` must be `'use client'`** (React error boundary). `not-found.tsx` can be RSC.

### RSC vs Client Components — discipline rules

- Default to **Server Component**. Add `'use client'` only when the component needs hooks, handlers, browser APIs, or Context.
- `'use client'` sits at the **leaf**. A page component stays RSC; it imports a leaf `<DishForm />` that is `'use client'`. This keeps the server/client tree boundary shallow and predictable.
- **Never pass non-serializable props across the boundary** (functions, Dates-as-Dates, class instances). Server Actions are the only function type allowed.
- **No Zustand, no Context for server data.** Server data lives in RSC fetches. Client-interactive state lives in `useState` / `useReducer` / TanStack Query cache. Auth state lives in the session cookie + DAL (section 3).

### Server Actions vs Route Handlers vs Edge Functions

Decision tree for this project:

```
Is this a form submit or button-triggered mutation from the portal UI?
  └── Yes → Server Action (wrapped in withAuth/withAdminAuth)

Is this a webhook from Supabase / Stripe / a cron / an external system?
  └── Yes → Route Handler (app/api/…/route.ts, wrapped)

Is it a public JSON API that non-browser clients call?
  └── Yes → Route Handler

Does it need to run close to the user (geolocation, redirect logic)?
  └── Yes → proxy.ts OR Supabase Edge Function (consumer data path)

Does the consumer mobile app call it?
  └── Supabase Edge Function (already how mobile talks to backend)
```

Server Actions are the default mutation surface for the portal. Route Handlers exist only for (a) webhooks, (b) the admin bulk-upload endpoints that accept large payloads, (c) any public JSON endpoint. Supabase Edge Functions remain owned by the mobile path (`nearby-restaurants`, `feed`, etc., per rough-idea).

### Forms — react-hook-form + Zod + Server Actions

The idiomatic marriage (per React/Next docs + community patterns, [freecodecamp guide](https://www.freecodecamp.org/news/react-form-validation-zod-react-hook-form/), [nehalist](https://nehalist.io/react-hook-form-with-nextjs-server-actions/)):

```tsx
// app/(app)/restaurants/[id]/RestaurantForm.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { basicInfoSchema, type BasicInfo } from '@eatme/shared/validation';
import { saveRestaurantBasics } from '../actions/restaurant';

export function RestaurantForm({ initial }: { initial?: Partial<BasicInfo> }) {
  const form = useForm<BasicInfo>({
    resolver: zodResolver(basicInfoSchema),
    defaultValues: initial,
  });

  async function onSubmit(values: BasicInfo) {
    const result = await saveRestaurantBasics(values); // Server Action
    if (!result.ok) {
      if (result.fieldErrors) {
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          form.setError(field as keyof BasicInfo, {
            type: 'server',
            message: messages[0],
          });
        }
      }
      if (result.formError) {
        form.setError('root.serverError', { message: result.formError });
      }
      return;
    }
    // success toast + router.refresh() or rely on revalidatePath inside the action
  }

  return <form onSubmit={form.handleSubmit(onSubmit)}>{/* fields */}</form>;
}
```

Client Zod = UX nicety. Server Action re-validates with the **same schema** — see section 4. We do **not** use `<form action={serverAction}>` with `useActionState` for the main portal forms: react-hook-form's field-level error UX is richer, and we already own it in v1. The `useActionState` pattern stays available for simple one-field forms (e.g. logout button, delete confirmation) where it actually simplifies things.

### Revalidation patterns

| Situation | Primitive | Why |
|---|---|---|
| Save draft field → same page should reflect it | `revalidatePath('/restaurants/[id]', 'page')` inside the Server Action | Cheapest, user stays put, RSC re-renders with fresh data. |
| Publish restaurant (draft → published) | `updateTag(\`restaurant-${id}\`)` + `updateTag('restaurant-list')` | New Next 16 API, read-your-writes semantics inside the Action so the next render has fresh data without round-tripping. ([blog](https://nextjs.org/blog/next-16#updatetag-new)) |
| Menu scan job status changed (from webhook) | `revalidateTag(\`scan-${jobId}\`, 'minutes')` | SWR behavior — stale data shown immediately, fresh fetched in background. |
| Notification count in header refreshes after "mark read" | `refresh()` inside the Server Action | Uncached, no tag needed. ([blog](https://nextjs.org/blog/next-16#refresh-new)) |

Rule: any data cached with `use cache` + a tag gets invalidated with `revalidateTag`/`updateTag`. Plain RSC fetches without caching invalidate via `revalidatePath`.

### Streaming + Suspense

- Use Suspense for the **menu-scan results panel** (slow OpenAI/Claude call). Stream the shell, suspend the panel.
- Avoid for primary navigation paths. Owner's dashboard should not suspend on anything — the whole point is "fast to interactive."
- Each `Suspense` boundary needs a meaningful `fallback`. Skeletons, not spinners.

---

## 3. Auth wrapper pattern — the centerpiece

v1's two bugs (from [auth review summary](../../2026-04-12-auth-flow-review/summary.md)):

1. Middleware was named `proxy.ts` but Next 15 needed `middleware.ts` → all route protection was dead code.
2. Admin checks read `user_metadata.role` (user-writable) instead of `app_metadata.role` (service-role-only) → any user could escalate from the browser console.

v2 prevents both **by construction**: every Server Action and Route Handler is wrapped; CI fails if one isn't.

### Signatures (sketch — confirm against `@supabase/ssr@latest` types before lock)

```ts
// apps/web-portal-v2/src/lib/auth/wrappers.ts
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createServerActionClient } from '@/lib/supabase/server';
import type { User } from '@supabase/supabase-js';

// The shape every wrapped Server Action returns to the client.
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; formError?: string; fieldErrors?: Record<string, string[]> };

// Authenticated user context passed to the handler.
export type AuthCtx = {
  user: User;          // full Supabase User (id, email, app_metadata, user_metadata, ...)
  userId: string;      // shortcut
  supabase: ReturnType<typeof createServerActionClient>;
};

// Server Action wrappers ------------------------------------------------
export function withAuth<Args extends unknown[], R>(
  handler: (ctx: AuthCtx, ...args: Args) => Promise<ActionResult<R>>,
): (...args: Args) => Promise<ActionResult<R>> {
  return async (...args) => {
    const supabase = createServerActionClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return { ok: false, formError: 'UNAUTHENTICATED' };
    }
    return handler({ user: data.user, userId: data.user.id, supabase }, ...args);
  };
}

export function withAdminAuth<Args extends unknown[], R>(
  handler: (ctx: AuthCtx, ...args: Args) => Promise<ActionResult<R>>,
): (...args: Args) => Promise<ActionResult<R>> {
  return async (...args) => {
    const supabase = createServerActionClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return { ok: false, formError: 'UNAUTHENTICATED' };

    // CRITICAL: app_metadata (service-role-only), NOT user_metadata.
    // See @supabase/auth-js types — User.app_metadata is server-writable only.
    const role = data.user.app_metadata?.role;
    if (role !== 'admin') return { ok: false, formError: 'FORBIDDEN' };

    return handler({ user: data.user, userId: data.user.id, supabase }, ...args);
  };
}

export function withPublic<Args extends unknown[], R>(
  handler: (ctx: { supabase: ReturnType<typeof createServerActionClient> }, ...args: Args) => Promise<ActionResult<R>>,
): (...args: Args) => Promise<ActionResult<R>> {
  return async (...args) => {
    const supabase = createServerActionClient();
    return handler({ supabase }, ...args);
  };
}
```

The generic `<Args extends unknown[], R>` is load-bearing — it propagates the handler's argument and return types through the wrapper, so `saveRestaurantBasics` at the call site still has full inference on inputs and `ActionResult<Restaurant>` on output. No `any`.

### Route Handler wrappers

```ts
// apps/web-portal-v2/src/lib/auth/route-wrappers.ts
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase/server';
import type { User } from '@supabase/supabase-js';

type RouteHandler<Params> = (
  ctx: { user: User; userId: string; supabase: ReturnType<typeof createRouteHandlerClient> },
  req: NextRequest,
  routeParams: { params: Promise<Params> },
) => Promise<Response>;

export function withAuthRoute<Params = Record<string, string>>(
  handler: RouteHandler<Params>,
): (req: NextRequest, routeParams: { params: Promise<Params> }) => Promise<Response> {
  return async (req, routeParams) => {
    const supabase = createRouteHandlerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
    }
    return handler({ user: data.user, userId: data.user.id, supabase }, req, routeParams);
  };
}

export function withAdminAuthRoute<Params = Record<string, string>>(
  handler: RouteHandler<Params>,
) {
  return async (req: NextRequest, routeParams: { params: Promise<Params> }) => {
    const supabase = createRouteHandlerClient();
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
```

Route params are now `Promise<Params>` in Next 16 — the wrapper keeps that shape and hands it straight through. ([async params breaking change](https://nextjs.org/blog/next-16#breaking-changes-and-other-updates))

### `app_metadata.role` — why, and how it gets set

Per `@supabase/auth-js` types (confirmed from [github source](https://github.com/supabase/auth-js/blob/master/src/lib/types.ts)):

```ts
export interface User {
  id: string;
  app_metadata: UserAppMetadata;   // service-role only
  user_metadata: UserMetadata;     // user-writable via auth.updateUser()
  email?: string;
  role?: string;                   // Postgres role ('authenticated', 'anon'), NOT RBAC role
  // ...
}
```

- `user_metadata` is writable by the client (`supabase.auth.updateUser({ data: { … } })`) → **never trust for authorization**.
- `app_metadata` is only writable via the Supabase service role (dashboard, migration, admin API).
- `User.role` at the top level is the **Postgres role** (`authenticated` / `anon`) — not a useful RBAC field. Don't conflate.

Admin role is granted by a migration or a server-side admin endpoint that uses the service role key to set `app_metadata.role = 'admin'`.

### `getUser()` vs `getSession()` vs `getClaims()`

- `getSession()` reads the cookie. **Unsafe in server code** — "isn't guaranteed to revalidate the Auth token" per Supabase docs.
- `getUser()` hits the Supabase Auth server and returns a full `User` (including `app_metadata`). **This is what wrappers use.**
- `getClaims()` (newer, recommended for route protection per Supabase docs) validates the JWT signature locally against published JWKS — fast and server-safe. Returns the decoded claims including `app_metadata`. **Open question**: do we use `getUser()` (remote call, authoritative) or `getClaims()` (local JWT verify, faster) inside wrappers? Recommendation: `getUser()` for wrappers (small latency cost bought by freshness — invalidating a compromised session mid-request matters more than 50ms), `getClaims()` for the DAL's `verifySession()` helper which is called from RSC on every request.

### Enforcement — CI check

Two layers:

1. **Naming convention** (enforced by ESLint): every export from `app/**/actions/*.ts` must be a call-expression whose callee is `withAuth`, `withAdminAuth`, or `withPublic`. Similar rule for `app/**/route.ts` — every `GET`/`POST`/etc. export must be a call to `withAuthRoute` / `withAdminAuthRoute` / `withPublicRoute`.

   Write a small custom ESLint rule (`no-unwrapped-action`) living in `packages/eslint-config-eatme/`. Run in CI as a blocking step. Adding a new route without a wrapper fails PR CI.

2. **Type-level guardrail**: wrappers return `ActionResult<T>`. The `'use server'` file shouldn't export a function whose return type isn't `Promise<ActionResult<unknown>>`. An ESLint rule or a TypeScript type-level check in `tsconfig` can enforce this.

Recommendation: **custom ESLint rule** as the practical enforcement — ships in the shared config, fails in `turbo lint`, no build-time cost.

### Usage examples

```ts
// app/(app)/actions/restaurant.ts
'use server';

import { withAuth } from '@/lib/auth/wrappers';
import { basicInfoSchema } from '@eatme/shared/validation';
import { revalidatePath } from 'next/cache';

export const saveRestaurantBasics = withAuth(async (ctx, input: unknown) => {
  const parsed = basicInfoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const { error } = await ctx.supabase
    .from('restaurants')
    .upsert({ ...parsed.data, owner_id: ctx.userId });
  if (error) return { ok: false, formError: error.message };
  revalidatePath('/restaurants');
  return { ok: true, data: undefined };
});
```

```ts
// app/api/admin/import-csv/route.ts
import { withAdminAuthRoute } from '@/lib/auth/route-wrappers';

export const POST = withAdminAuthRoute(async (ctx, req) => {
  const csv = await req.text();
  // ... ctx.supabase is cookie-aware; ctx.user.app_metadata.role === 'admin' guaranteed.
  return Response.json({ imported: 42 });
});
```

```tsx
// app/(app)/dashboard/page.tsx — protected page
import { verifySession } from '@/lib/auth/dal';

export default async function DashboardPage() {
  const session = await verifySession(); // redirects if not logged in
  return <OwnerDashboard userId={session.userId} />;
}
```

```tsx
// app/(marketing)/page.tsx — public page
export default function LandingPage() {
  return <Landing />; // no auth calls
}
```

```tsx
// app/(admin)/admin/layout.tsx — admin-only shell
import { verifyAdminSession } from '@/lib/auth/dal';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await verifyAdminSession(); // redirects non-admins to /
  return <AdminShell>{children}</AdminShell>;
}
```

### DAL — shared helper for pages

Following Next.js' Data Access Layer recommendation ([docs](https://nextjs.org/docs/app/guides/authentication#creating-a-data-access-layer-dal)):

```ts
// apps/web-portal-v2/src/lib/auth/dal.ts
import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';

export const verifySession = cache(async () => {
  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect('/login');
  return { userId: data.user.id, user: data.user };
});

export const verifyAdminSession = cache(async () => {
  const session = await verifySession();
  if (session.user.app_metadata?.role !== 'admin') redirect('/');
  return session;
});
```

`cache()` dedupes across a single render pass — calling `verifySession()` from a layout and three child RSCs hits Supabase once.

---

## 4. Server-side Zod validation idioms

### Single-source schemas

```ts
// packages/shared/src/validation/restaurant.ts  (existing)
export const basicInfoSchema = z.object({ /* … */ });
export type BasicInfo = z.infer<typeof basicInfoSchema>;
```

Both client (`zodResolver(basicInfoSchema)`) and server (`basicInfoSchema.safeParse(input)`) import the **same** symbol from `@eatme/shared`. No drift possible.

### FormData → Zod → discriminated union

For `dish_kind`-driven branching, use Zod's discriminated union:

```ts
// packages/shared/src/validation/dish.ts
const baseDish = z.object({
  name: z.string().min(1),
  price_cents: z.number().int().nonnegative(),
  primary_protein: z.enum(PRIMARY_PROTEINS),
});

export const dishSchema = z.discriminatedUnion('dish_kind', [
  baseDish.extend({ dish_kind: z.literal('standard') }),
  baseDish.extend({ dish_kind: z.literal('bundle'), bundle_items: z.array(z.string().uuid()) }),
  baseDish.extend({
    dish_kind: z.literal('configurable'),
    is_template: z.boolean().default(false),
    slots: z.array(slotSchema),
  }),
  baseDish.extend({ dish_kind: z.literal('course_menu'), courses: z.array(courseSchema) }),
  baseDish.extend({ dish_kind: z.literal('buffet') }),
]);
export type Dish = z.infer<typeof dishSchema>;
```

Server Action:

```ts
export const saveDish = withAuth(async (ctx, raw: unknown) => {
  const parsed = dishSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }
  // parsed.data is now the narrowed Dish type.
  // Downstream: `if (parsed.data.dish_kind === 'configurable') { parsed.data.slots ... }` — fully typed.
  return insertDish(ctx.supabase, parsed.data);
});
```

### Error shape

```ts
type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; formError?: string; fieldErrors?: Record<string, string[]> };
```

`fieldErrors` matches `z.ZodError.flatten().fieldErrors` exactly — `Record<string, string[]>` keyed by field path. Maps 1:1 onto `form.setError(field, { message })`. See section 2 for the client-side mapping.

For nested errors (e.g. `courses[0].name`), use `parsed.error.flatten((issue) => issue.message, { nested: true })` or the newer `z.treeifyError(err)` in Zod 4. The wrapper normalises to dot-path keys (`courses.0.name`) which react-hook-form accepts.

### Parse-don't-validate

Downstream DB writes take `parsed.data: Dish`, not `unknown`. No `as` casts. If a refactor adds a field, TypeScript breaks at the insert site.

---

## 5. Supabase SSR integration

Package: `@supabase/ssr` (current; `@supabase/auth-helpers-nextjs` is EOL'd). ([Supabase SSR docs](https://supabase.com/docs/guides/auth/server-side/creating-a-client))

### Three-function client factory in `@eatme/database`

`packages/database/src/client.ts` currently has `getWebClient` (deprecated per its own comment) and `getMobileClient`. v2 adds three explicit web factories. Mobile's `getMobileClient` stays unchanged (per non-breaking constraint).

```ts
// packages/database/src/web.ts  (NEW — web-only, not imported by mobile)
import { createServerClient as _createServerClient, createBrowserClient as _createBrowserClient } from '@supabase/ssr';
import type { Database } from './types';

// --- Browser (Client Components) ---
export function createBrowserClient(url: string, anonKey: string) {
  return _createBrowserClient<Database>(url, anonKey);
}

// --- Server Components (read-only; cookie writes are swallowed) ---
export function createServerClient(
  url: string,
  anonKey: string,
  cookieStore: {
    getAll: () => { name: string; value: string }[];
    setAll: (cookies: { name: string; value: string; options?: Record<string, unknown> }[]) => void;
  },
) {
  return _createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          cookieStore.setAll(toSet);
        } catch {
          // Server Components cannot set cookies; ignore. Proxy handles refresh.
        }
      },
    },
  });
}

// --- Server Actions + Route Handlers (read + write) ---
export function createServerActionClient(
  url: string,
  anonKey: string,
  cookieStore: {
    getAll: () => { name: string; value: string }[];
    setAll: (cookies: { name: string; value: string; options?: Record<string, unknown> }[]) => void;
  },
) {
  return _createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => cookieStore.setAll(toSet), // no try/catch — writes MUST succeed here
    },
  });
}
```

App-side usage (thin wrappers that close over the Next.js cookie store):

```ts
// apps/web-portal-v2/src/lib/supabase/server.ts
import { cookies } from 'next/headers';
import { createServerClient as _cs, createServerActionClient as _csa } from '@eatme/database/web';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function createServerClient() {
  const cookieStore = await cookies();
  return _cs(URL, KEY, {
    getAll: () => cookieStore.getAll(),
    setAll: (toSet) => toSet.forEach((c) => cookieStore.set(c.name, c.value, c.options)),
  });
}

export async function createServerActionClient() {
  const cookieStore = await cookies();
  return _csa(URL, KEY, {
    getAll: () => cookieStore.getAll(),
    setAll: (toSet) => toSet.forEach((c) => cookieStore.set(c.name, c.value, c.options)),
  });
}

export const createRouteHandlerClient = createServerActionClient; // same cookie semantics
```

```ts
// apps/web-portal-v2/src/lib/supabase/browser.ts
'use client';
import { createBrowserClient } from '@eatme/database/web';
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
```

### `proxy.ts` — cookie refresh + optimistic redirects

```ts
// apps/web-portal-v2/proxy.ts
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@eatme/database/types';

export async function proxy(req: NextRequest) {
  let response = NextResponse.next({ request: req });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value, options }) => {
            req.cookies.set({ name, value, ...options });
            response.cookies.set({ name, value, ...options });
          });
        },
      },
    },
  );

  // This call refreshes the access token if needed (sets new cookies on `response`).
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  const path = req.nextUrl.pathname;

  // Optimistic redirect only. The real gate is in Server Actions / DAL / RSC pages.
  const isAuthRoute = path.startsWith('/login') || path.startsWith('/signup');
  const isAppRoute = path.startsWith('/dashboard') || path.startsWith('/restaurants');

  if (!user && isAppRoute) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', path);
    return NextResponse.redirect(url);
  }
  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg)).*)'],
};
```

Everything else about v1's proxy logic — `app_metadata.role` check for `/admin` paths — moves **out of proxy** and into the `verifyAdminSession()` DAL helper (section 3). Reason: proxy is for optimistic redirects, not security. The wrapper-based pattern is the security gate.

---

## 6. TanStack Query placement in a Server-Actions-first app

### When Query earns its keep

In a RSC-first app, most reads are server-rendered. Query is there for:

1. **Client-interactive lists with filter/sort/pagination state in URL search params** — keeping the RSC fetch and updating via Server Action is possible but the UX for rapid filter changes is cleaner with Query's optimistic state.
2. **Menu-scan job polling/realtime** — the scan progress panel subscribes to a Supabase Realtime channel, and the mutations (confirm, cancel, retry) need optimistic updates + rollback.
3. **Client-side dirty-tracking during long edit sessions** — owner editing a 40-dish menu wants immediate feedback; TanStack's mutation state (`isPending`, `isError`, `isSuccess`) is the right shape.
4. **Autocomplete / search-as-you-type** — cuisines, dish aliases; debounced queries benefit from Query's cache dedup.

### Prefetch + hydrate pattern

```tsx
// app/(app)/restaurants/[id]/page.tsx — RSC
import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query/client';
import { verifySession } from '@/lib/auth/dal';
import { RestaurantEditor } from './RestaurantEditor';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await verifySession();
  const queryClient = getQueryClient();

  await queryClient.prefetchQuery({
    queryKey: ['restaurant', id],
    queryFn: () => fetchRestaurantById(id), // calls Supabase on the server
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <RestaurantEditor restaurantId={id} />
    </HydrationBoundary>
  );
}
```

```tsx
// app/(app)/providers.tsx
'use client';
import { QueryClientProvider } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query/client';

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
```

```ts
// lib/query/client.ts — TanStack's canonical isServer-aware singleton.
// Per https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr
import { isServer, QueryClient } from '@tanstack/react-query';
function make() {
  return new QueryClient({ defaultOptions: { queries: { staleTime: 60_000 } } });
}
let browserClient: QueryClient | undefined;
export function getQueryClient() {
  if (isServer) return make();
  browserClient ??= make();
  return browserClient;
}
```

### Query vs `revalidatePath` after mutations

| Situation | Use |
|---|---|
| Server Action mutates; page is RSC-rendered with no client Query state for that data | `revalidatePath` / `updateTag` inside the action. Page re-renders with fresh data. |
| Server Action mutates; component uses `useQuery` for the same key | Return updated data from action; `queryClient.setQueryData(['key'], returned)` in the mutation's `onSuccess`. Optionally `invalidateQueries` for a refetch safety net. |
| Realtime push (Supabase channel) arrives | Client-side handler calls `queryClient.setQueryData(['scan', jobId], next)`. No server round-trip. |

Don't mix: if a page's data is read by RSC, don't also fetch it in `useQuery` — pick one. The hybrid (RSC prefetch → Query hydrate → client mutations → `setQueryData`) is the fully-featured pattern; use it where real-time matters.

### Realtime channel integration

No "official" TanStack pattern — community pattern is mount the channel in an effect, feed messages into `setQueryData`:

```tsx
// components/ScanProgress.tsx
'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase/browser';

export function ScanProgress({ jobId }: { jobId: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['scan', jobId],
    queryFn: () => fetchScanJob(jobId),
  });

  useEffect(() => {
    const channel = supabase
      .channel(`scan-${jobId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'menu_scan_jobs', filter: `id=eq.${jobId}` },
        (payload) => qc.setQueryData(['scan', jobId], payload.new),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [jobId, qc]);

  return <ScanProgressView job={data} />;
}
```

(Sketch — confirm `postgres_changes` payload shape against `@supabase/supabase-js` v2 types.)

---

## 7. Two-app monorepo specifics

Two Next.js apps: `apps/web-portal-v2/` (owner) and `apps/admin/`. Shared packages per CLAUDE.md: `@eatme/database`, `@eatme/shared`, `@eatme/tokens`.

### `transpilePackages`

```ts
// apps/web-portal-v2/next.config.ts
import type { NextConfig } from 'next';
const config: NextConfig = {
  transpilePackages: ['@eatme/shared', '@eatme/database', '@eatme/tokens', '@eatme/ui'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
};
export default config;
```

Same shape in `apps/admin/next.config.ts`. Turbopack respects `transpilePackages` unchanged. ([docs](https://nextjs.org/docs/app/api-reference/config/next-config-js/transpilePackages))

### Tailwind v4 + shadcn/ui

Per [shadcn monorepo docs](https://ui.shadcn.com/docs/monorepo):

> "Every workspace must have a `components.json` file."

**Decision**: create a shared `packages/ui/` that hosts the shadcn components + Tailwind source; each app has a thin `components.json` pointing to `@eatme/ui/components/*`. Both apps add `@eatme/ui` to `transpilePackages`.

```
packages/ui/
├── components.json          # defines @eatme/ui/components/ui/* alias
├── package.json
├── src/
│   ├── styles/
│   │   └── globals.css      # @import "tailwindcss"; @import "@eatme/tokens/css";
│   └── components/
│       └── ui/{button,input,form,…}.tsx
```

```
apps/web-portal-v2/
├── components.json          # thin config: paths → @eatme/ui
├── postcss.config.mjs       # @tailwindcss/postcss
└── app/globals.css          # @import "@eatme/ui/styles/globals.css";
```

Tailwind v4 is PostCSS-based (no tailwind.config.js — theme tokens live in CSS via `@theme`). `@eatme/tokens` exports a `tokens.css` that both apps import; shadcn components in `@eatme/ui` consume the CSS variables it defines.

### Sharing `proxy.ts` between apps

`proxy.ts` must be at each app's root (only one per project). Factor the shared logic into `packages/ui/auth/proxy-factory.ts` (or `@eatme/shared/auth/proxy`):

```ts
// packages/shared/src/auth/proxy.ts
export function createAuthProxy(config: {
  url: string;
  anonKey: string;
  appRoutes: string[];     // paths that require auth
  authRoutes: string[];    // login/signup (redirect logged-in users away)
  adminOnly?: string[];    // paths that require admin role
}) {
  return async function proxy(req: NextRequest) {
    // ... implementation from section 5
  };
}
```

```ts
// apps/web-portal-v2/proxy.ts
export { proxy, config } from './proxy-config';

// apps/web-portal-v2/proxy-config.ts
import { createAuthProxy } from '@eatme/shared/auth/proxy';
export const proxy = createAuthProxy({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  appRoutes: ['/dashboard', '/restaurants', '/menus'],
  authRoutes: ['/login', '/signup'],
});
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
```

Admin app is identical with a different `appRoutes` and `adminOnly: ['/admin/**']`. Shared factory, one place to audit.

### Environment variables

Each app owns its `.env.local`. Shared **constants** (non-secret values: dish kinds, cuisines, feature flags) live in `@eatme/shared/constants`. Env-var access stays app-local because Next.js replaces `process.env.NEXT_PUBLIC_*` at build time against literal keys (same reason `@eatme/database/client.ts` takes URL/key as params today — per its own file header comment).

Convention:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — both apps
- `SUPABASE_SERVICE_ROLE_KEY` — admin app only, Server Actions only (never exposed)
- `NEXT_PUBLIC_APP_ENV` — `development` | `preview` | `production`

---

## 8. Summary — decisions to land in v2 design

Hard calls that the foundation locks in:

1. **Next.js 16.2+, React 19.2, Node 20.9+, TypeScript 5.1+.** Pinned in root `package.json` engines.
2. **`proxy.ts`, not `middleware.ts`.** One per app, at the app root. Shared factory in `@eatme/shared/auth/proxy`. Node.js runtime.
3. **Proxy does cookie refresh + optimistic redirects only.** Every admin/role check lives in Server Action wrappers or the DAL, never in proxy.
4. **Auth wrappers are mandatory.** `withAuth`, `withAdminAuth`, `withPublic` for Server Actions; `withAuthRoute`, `withAdminAuthRoute`, `withPublicRoute` for Route Handlers. Admin role is read from `app_metadata.role` (server-writable only). Wrapper signatures preserve full generic type inference on args and return.
5. **Custom ESLint rule `no-unwrapped-action` blocks PRs** that export non-wrapped handlers from `app/**/actions/*.ts` or `app/**/route.ts`. Ships in `packages/eslint-config-eatme/`.
6. **DAL pattern for RSC auth checks.** `verifySession()` + `verifyAdminSession()` in `src/lib/auth/dal.ts`, wrapped in React `cache()` for per-request dedup. Called from layouts and pages.
7. **Server-side Zod is the gate; client-side is UX.** Same schema from `@eatme/shared/validation` runs both sides. Server Action returns `ActionResult<T>` with `fieldErrors` shaped to match `z.flatten().fieldErrors` so react-hook-form's `setError` maps 1:1.
8. **Three Supabase client factories** exposed from `@eatme/database/web`: `createBrowserClient`, `createServerClient` (RSC, swallows cookie writes), `createServerActionClient` (Actions + Route Handlers, full read/write). Mobile keeps `getMobileClient` unchanged per non-breaking constraint.
9. **`getUser()` in wrappers** (authoritative, remote), `getClaims()` **in DAL** (local JWT verify, fast) — open question, may settle on `getClaims()` everywhere if the Supabase team confirms it's the recommended path for Next.js 16.
10. **Revalidation primitives**: `updateTag()` for draft→published (read-your-writes), `revalidateTag(tag, 'max')` for SWR-tolerant public feeds, `refresh()` for uncached status counters, `revalidatePath` for RSC-only pages with no cache tags. Server Actions own the call; client never triggers server revalidation directly.
11. **TanStack Query for client-interactive surfaces only.** RSC + Server Actions handle the primary data path. Query is layered on where real-time (Supabase channels), optimistic mutations, or fast client-side filtering are needed. Prefetch + `HydrationBoundary` pattern when both live on the same page.
12. **No Cache Components, no React Compiler, no Turbopack filesystem cache** for v2.0. Reassess after ship.
13. **Two apps, one shared UI package.** `packages/ui/` owns shadcn components + Tailwind source; each app has a thin `components.json` pointing into it. Both apps list `@eatme/shared`, `@eatme/database`, `@eatme/tokens`, `@eatme/ui` in `transpilePackages`.
14. **Tailwind v4 via `@tailwindcss/postcss`.** Theme tokens in CSS (`@theme`), imported from `@eatme/tokens/tokens.css`.
15. **`images.remotePatterns` only** (no `images.domains`). `quality={75}` explicit on portal image renders.
16. **`next lint` is dead.** CI runs `eslint` + `tsc --noEmit` separately from `next build`. `turbo lint` is the gate.
17. **Route params are async** — templates use `params: Promise<{ id: string }>` and `await` them.
18. **Parallel routes require `default.tsx`** — if we introduce any, scaffolding includes one.

---

## References

- Next.js 16 release — https://nextjs.org/blog/next-16
- Next.js 16.2 release — https://nextjs.org/blog/next-16-2
- Proxy (Middleware replacement) — https://nextjs.org/docs/app/getting-started/proxy
- Authentication guide (DAL pattern) — https://nextjs.org/docs/app/guides/authentication
- `transpilePackages` — https://nextjs.org/docs/app/api-reference/config/next-config-js/transpilePackages
- Supabase SSR client creation — https://supabase.com/docs/guides/auth/server-side/creating-a-client
- Supabase Next.js quickstart — https://supabase.com/docs/guides/auth/server-side/nextjs
- `@supabase/auth-js` User type — https://github.com/supabase/auth-js/blob/master/src/lib/types.ts
- TanStack Query SSR advanced — https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr
- Tailwind v4 + Next.js — https://tailwindcss.com/docs/installation/framework-guides/nextjs
- shadcn/ui monorepo — https://ui.shadcn.com/docs/monorepo
- React Hook Form `setError` — https://react-hook-form.com/docs/useform/seterror
- react-hook-form + Server Actions (community) — https://nehalist.io/react-hook-form-with-nextjs-server-actions/
- v1 auth flow summary — `.agents/planning/2026-04-12-auth-flow-review/summary.md`
- v1 auth detailed design — `.agents/planning/2026-04-12-auth-flow-review/design/detailed-design.md`
