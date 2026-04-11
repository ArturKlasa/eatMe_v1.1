/**
 * Shared test mock factories for the web-portal test suite.
 *
 * Each factory creates fresh `vi.fn()` instances, so they can be used safely
 * inside `vi.mock()` factory callbacks:
 *
 * ```ts
 * import { createToastMock } from '@/test/helpers'
 * vi.mock('sonner', () => createToastMock())
 * ```
 */
export { createToastMock } from './mockToast'
export { createSupabaseMock } from './mockSupabase'
export { createRouterMock } from './mockRouter'
