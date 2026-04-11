import { vi } from 'vitest'

/**
 * Creates a mock for Next.js navigation hooks (`next/navigation`).
 *
 * Returns the mock factory suitable for use inside `vi.mock('next/navigation', ...)`.
 * Exposes `mockPush` and `mockBack` as named exports so individual tests can
 * assert on navigation calls.
 */
export function createRouterMock() {
  const mockPush = vi.fn()
  const mockBack = vi.fn()
  const mockReplace = vi.fn()

  return {
    useRouter: vi.fn().mockReturnValue({
      push: mockPush,
      back: mockBack,
      replace: mockReplace,
    }),
    useParams: vi.fn().mockReturnValue({}),
    usePathname: vi.fn().mockReturnValue('/'),
    mockPush,
    mockBack,
    mockReplace,
  }
}
