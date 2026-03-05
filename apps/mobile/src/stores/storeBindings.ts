/**
 * Store Bindings
 *
 * Wires reactive subscriptions between independent Zustand stores so that each
 * store can respond to auth state changes without authStore needing to know
 * about them (decoupling A5 from CODEBASE_IMPROVEMENTS.md).
 *
 * Pattern: instead of authStore calling into filterStore/onboardingStore
 * directly, this module subscribes to authStore and lets each store react
 * independently. Adding a new store that reacts to login only requires a
 * change here, not in authStore.
 *
 * Call initStoreBindings() once at app startup (before auth is initialized)
 * and pass the returned cleanup function to useEffect's return.
 */

import { useAuthStore } from './authStore';
import { useFilterStore } from './filterStore';
import { useOnboardingStore } from './onboardingStore';

/**
 * Subscribe to auth state changes and trigger per-store sync reactions.
 *
 * @returns Unsubscribe function — pass this as the useEffect cleanup.
 *
 * @example
 * useEffect(() => initStoreBindings(), []);
 */
export function initStoreBindings(): () => void {
  let prevUserId: string | null = null;

  const unsubscribe = useAuthStore.subscribe(state => {
    const currentUserId = state.user?.id ?? null;

    // Only act on a genuine login transition (null → id, or id change).
    // This guards against double-firing when both initialize() and the
    // onAuthStateChange SIGNED_IN event both call set({ user }) in quick
    // succession with the same user.
    if (currentUserId && currentUserId !== prevUserId) {
      // Each store handles its own DB sync — authStore is not involved
      useFilterStore.getState().syncWithDatabase(currentUserId);
      useOnboardingStore.getState().loadUserPreferences(currentUserId);
    }

    prevUserId = currentUserId;
  });

  return unsubscribe;
}
