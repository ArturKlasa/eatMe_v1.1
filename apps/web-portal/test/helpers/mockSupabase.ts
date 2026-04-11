import { vi } from 'vitest'

/**
 * Creates a chainable mock for the Supabase client (`@/lib/supabase`).
 *
 * Returns an object shaped like the `createClient` export. Individual tests
 * can override specific methods with `mockResolvedValueOnce` after calling
 * this factory.
 *
 * Why Object.assign / returnThis: Supabase's query builder is a fluent chain
 * (`from().select().eq().single()`). Each chainable method must return the
 * same mock object so the chain stays intact.
 */
export function createSupabaseMock(overrides?: {
  data?: unknown
  error?: null | { message: string }
}) {
  const resolved = { data: overrides?.data ?? null, error: overrides?.error ?? null }

  const mockChain = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(resolved),
    maybeSingle: vi.fn().mockResolvedValue(resolved),
    then: undefined as unknown,
  }

  // Make the chain itself thenable so `await supabase.from(...).select(...)` works
  mockChain.then = vi.fn().mockResolvedValue(resolved)

  return {
    createClient: vi.fn().mockReturnValue(mockChain),
    mockChain,
  }
}
