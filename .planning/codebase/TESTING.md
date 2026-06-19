# Testing Patterns

**Analysis Date:** 2026-06-19

## Test Frameworks

### Web-Portal (apps/web-portal/)

**Runner:** Vitest (latest)
**Config:** `apps/web-portal/vitest.config.ts`
**Environment:** jsdom
**Globals:** enabled (`globals: true` — no explicit import of `describe/it/expect` needed, though most files import explicitly)
**Setup file:** `apps/web-portal/test/setup.ts`

```bash
cd apps/web-portal && npx vitest run    # Run all tests once
cd apps/web-portal && npx vitest        # Watch mode
# No coverage script configured
```

From repo root:
```bash
turbo test    # Runs vitest across all packages with test suites
```

### Admin App (apps/admin/)

**Runner:** Vitest
**Config:** `apps/admin/vitest.config.ts`
**Environment:** node
**Alias:** `@/` → `apps/admin/src/`
**Integration tests** have a separate config: `apps/admin/vitest.integration.config.ts`

```bash
cd apps/admin && npx vitest run                                             # Unit tests
cd apps/admin && npx vitest run --config vitest.integration.config.ts      # Integration (needs local Supabase)
cd apps/admin && npx playwright test                                        # E2E tests
```

### Shared Package (packages/shared/)

**Runner:** Vitest
**Config:** `packages/shared/vitest.config.ts`
**Environment:** node
**Test location:** `src/**/*.test.ts` and `src/__tests__/`

### Edge Functions — Migration Tests (infra/supabase/tests/)

These are **Vitest tests** (not Deno), co-located in `infra/supabase/tests/migrations/`. They use conditional `describe.skip` to guard integration blocks:

```typescript
const isIntegration = Boolean(
  process.env.SUPABASE_LOCAL_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
);
const describeIntegration = isIntegration ? describe : describe.skip;
```

Run integration blocks:
```bash
SUPABASE_LOCAL_URL=http://127.0.0.1:54321 \
SUPABASE_SERVICE_ROLE_KEY=<key> \
vitest run infra/supabase/tests/migrations/<file>.test.ts
```

**Deno tests** (if any edge function has Deno-native tests) are run with:
```bash
~/.deno/bin/deno test --node-modules-dir=none -A <path>
```

## Test File Organization

**Web-portal:** All tests in a top-level `test/` directory — NOT co-located with source.
```
apps/web-portal/
├── test/
│   ├── setup.ts                    # Global setup (jest-dom import + global mocks)
│   ├── SectionCard.test.tsx        # Component test
│   ├── useRestaurantDraft.test.ts  # Hook utility test
│   ├── middleware.test.ts          # Middleware integration test
│   ├── import-service.test.ts      # Service logic unit test
│   └── ...
```

**Admin:** Tests in `src/__tests__/` with domain subdirectories:
```
apps/admin/src/__tests__/
├── auth/
├── restaurants/
├── imports/
├── menu-scan/
└── integration/
```

**Shared package:** Tests in `src/__tests__/` (alongside source) and inline as `*.test.ts` inside `src/validation/`:
```
packages/shared/src/
├── validation/
│   ├── cuisine.test.ts
│   └── dish-kinds.test.ts
└── __tests__/
    └── v2-schemas.test.ts
```

**Migration tests:** `infra/supabase/tests/migrations/`

**Naming convention:** `<SubjectName>.test.ts` or `<SubjectName>.test.tsx` — mirrors the component/module name exactly.

## Global Test Setup

`apps/web-portal/test/setup.ts` applies globally via `setupFiles` in vitest config:

```typescript
import "@testing-library/jest-dom";
import { vi } from 'vitest';

// Polyfill ResizeObserver for Radix UI components in jsdom
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Global mock for sonner toast — available in all tests
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  }),
}))
```

## Test Structure

**Standard suite structure:**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('SubjectName', () => {
  beforeEach(() => {
    vi.clearAllMocks();   // Reset mocks between tests
  });

  it('returns X when Y', () => {
    // Arrange — Act — Assert
    expect(result).toBe(expected);
  });
});
```

**Section divider pattern** (used in larger test files):
```typescript
// ─── computeWarningFlags ──────────────────────────────────────────────────────
describe('computeWarningFlags', () => { ... });

// ─── deduplicateRestaurants ───────────────────────────────────────────────────
describe('deduplicateRestaurants', () => { ... });
```

**Nested describe for sub-cases:**
```typescript
describe('middleware (auth redirects)', () => {
  describe('unauthenticated user', () => { ... });
  describe('authenticated user', () => { ... });
  describe('authenticated non-admin user', () => { ... });
});
```

## Mocking

**Framework:** `vi` from Vitest

### Module mocking — hoist before imports

```typescript
// Mock BEFORE importing the module under test
vi.mock('@/lib/storage', () => ({
  loadRestaurantData: vi.fn(),
  autoSave: vi.fn(),
}));

// Import AFTER mock declaration
import { loadRestaurantData } from '@/lib/storage';
```

For modules with circular dependency issues, use dynamic import after mock:
```typescript
vi.mock('@/lib/supabase-server', () => ({ createMiddlewareClient: vi.fn(...) }));
const { middleware } = await import('@/middleware');
```

### Server-only + Next.js mocks (admin tests)

```typescript
vi.mock('server-only', () => ({}));
vi.mock('react', async importActual => {
  const actual = await importActual<typeof import('react')>();
  return { ...actual, cache: (fn: unknown) => fn };
});
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
```

### Asserting mock calls

```typescript
// Check a vi.fn() was called with specific args
import { loadRestaurantData } from '@/lib/storage';
vi.mocked(loadRestaurantData).mockReturnValue(null);
expect(loadRestaurantData).toHaveBeenCalledWith(...);
```

### Manual Supabase client mock (preferred over module mock)

```typescript
const mockSupabase = {
  from: vi.fn((table: string) => {
    if (table === 'restaurants') {
      return {
        select: vi.fn(() => ({ in: vi.fn().mockResolvedValue({ data: [] }) })),
        insert: vi.fn(rows => ({ select: vi.fn().mockResolvedValue({ data: insertedRows, error: null }) })),
      };
    }
    return { insert: vi.fn().mockResolvedValue({ data: null, error: null }) };
  }),
};
// Pass as `supabase as never` to bypass type checking
await importRestaurants([...], 'google_places', 'admin-1', 'admin@example.com', mockSupabase as never);
```

**What to mock:**
- External I/O: Supabase client, localStorage helpers, `next/navigation`, `server-only`
- Global libraries: `sonner` toast (mocked globally in setup.ts)
- `ResizeObserver` (polyfilled in setup.ts for Radix UI)

**What NOT to mock:**
- Pure logic functions (`computeWarningFlags`, `isAdmin`, `isDiscoverable`) — test them directly
- Zod schemas — test with real schema instances

## Compile-Time / Type-Safety Tests

Migration tests include "compile-time" test blocks that verify TypeScript types match DB schema:

```typescript
describe('menu_scan_jobs type parity (compile-time)', () => {
  it('Row includes new columns with correct types', () => {
    type Row = Database['public']['Tables']['menu_scan_jobs']['Row'];
    const _attempts: Row['attempts'] = 0;
    (void _attempts);
    expect(true).toBe(true);  // Type error = compile failure = CI failure
  });
});
```

This pattern enforces that generated Supabase types stay in sync with migrations.

## Fixtures and Test Data

No shared fixture factory library. Tests declare inline fixtures:

```typescript
// Base object for mutation in subtests
const baseRow = {
  id: 'r1',
  name: 'El Paisa',
  location: { lat: 19.39, lng: -99.16 },
  // ... all fields explicit
};

// Spread to override specific fields
const flags = computeWarningFlags({ ...baseRow, cuisine_types: [] } as never, 5);
```

Integration tests use helper factory functions to isolate test data:
```typescript
// apps/admin/src/__tests__/integration/admin-confirm-rpc.test.ts
function uniqueTestId(): string {
  return `phase42-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

async function createFixture(): Promise<Fixture> { ... }  // Creates real DB rows
// afterEach cleans up fixtures
```

## Test Types

**Unit tests (majority):**
- Pure function testing: logic, validators, warning flag computation
- Hook testing with `renderHook` from `@testing-library/react`
- Component rendering with `render`, `fireEvent` from `@testing-library/react`
- Service tests with manual Supabase mock objects

**Integration tests (gated):**
- Migration tests in `infra/supabase/tests/migrations/` — require local Supabase via env vars
- Admin integration tests in `apps/admin/src/__tests__/integration/` — hit real local Supabase; use `afterEach` cleanup

**CI Guard / Linting tests:**
- `apps/web-portal/test/no-hardcoded-colors.test.ts` — scans `.tsx` files for banned Tailwind color classes
- `apps/web-portal/test/migration-115-tighten-check.test.ts` — SQL migration correctness check
- `packages/eslint-config-eatme/rules/no-unwrapped-action.test.ts` — custom ESLint rule correctness

**E2E tests:**
- Playwright configured in `apps/admin` (`test:e2e` script). No test files found in scope; likely thin or in progress.

**Mobile:** No automated test suite. Visual/UX testing is on-device by the developer.

## Common Patterns

**Fake timers for debounce/async timing:**
```typescript
it('does not update before the delay', () => {
  vi.useFakeTimers();
  const { result, rerender } = renderHook(
    ({ value }) => useDebounce(value, 300),
    { initialProps: { value: 'a' } }
  );
  rerender({ value: 'b' });
  vi.advanceTimersByTime(100);
  expect(result.current).toBe('a');
  vi.useRealTimers();    // Always restore
});

// For state updates triggered by timer:
act(() => { vi.advanceTimersByTime(300); });
```

**Async service testing:**
```typescript
it('returns correct summary counts', async () => {
  const summary = await importRestaurants([...], 'google_places', ...);
  expect(summary.inserted).toBe(1);
  expect(summary.errors).toHaveLength(0);
});
```

**DB constraint error testing:**
```typescript
it('rejects invalid status value', async () => {
  const { error } = await service.from('menu_scan_jobs').insert({ status: 'bogus' as never });
  expect(error).not.toBeNull();
  expect(error?.message).toMatch(/check|constraint/i);
});
```

**RLS empty-result testing:**
```typescript
it('anon cannot select from menu_scan_jobs', async () => {
  const { data, error } = await anonClient.from('menu_scan_jobs').select('id');
  expect(error).toBeNull();
  // RLS deny-all for anon → empty result, not an error
  expect((data ?? []).length).toBe(0);
});
```

## Coverage

**Requirements:** None enforced. No coverage thresholds in vitest configs.

**View coverage (ad hoc):**
```bash
cd apps/web-portal && npx vitest run --coverage
```

---

*Testing analysis: 2026-06-19*
