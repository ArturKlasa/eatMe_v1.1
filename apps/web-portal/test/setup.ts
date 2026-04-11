import "@testing-library/jest-dom";
import { vi } from 'vitest'

// Polyfill ResizeObserver for Radix UI components in jsdom
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

/**
 * Global mock for the sonner toast library.
 *
 * Registered here once so every test file gets the same mock shape without
 * repeating the factory. `toast` is both callable and has named methods so
 * it satisfies every usage pattern in the codebase.
 *
 * Individual tests can assert calls with:
 *   import { toast } from 'sonner'
 *   expect(toast.success).toHaveBeenCalledWith(...)
 */
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  }),
}))
