import { vi } from 'vitest'

/**
 * Creates a mock for the sonner toast library.
 *
 * Returns `toast` as a callable function (for `toast(msg)` usage) with the
 * four named methods attached — a superset that satisfies every test variant
 * (simple `toast.success`, extended `Object.assign` patterns).
 */
export function createToastMock() {
  return {
    toast: Object.assign(vi.fn(), {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
    }),
  }
}
