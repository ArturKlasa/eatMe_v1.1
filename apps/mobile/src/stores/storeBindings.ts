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

import AsyncStorage from '@react-native-async-storage/async-storage';
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
const SYNC_DEBOUNCE_MS = 30 * 60 * 1000; // 30 minutes

const FILTER_LAST_SYNCED_KEY = '@eatme_last_synced_at';
const ONBOARDING_LAST_SYNCED_KEY = '@eatme_onboarding_last_synced_at';

export function initStoreBindings(): () => void {
  let prevUserId: string | null = null;

  const unsubscribe = useAuthStore.subscribe(async state => {
    const currentUserId = state.user?.id ?? null;

    // Reset lastSyncedAt on logout so the next login always triggers a fresh sync
    if (!currentUserId && prevUserId) {
      useFilterStore.setState({ lastSyncedAt: null });
      useOnboardingStore.setState({ lastSyncedAt: null });
      // Clear persisted timestamps so the next login is not throttled
      AsyncStorage.removeItem(FILTER_LAST_SYNCED_KEY).catch(() => {});
      AsyncStorage.removeItem(ONBOARDING_LAST_SYNCED_KEY).catch(() => {});
    }

    // Only act on a genuine login transition (null → id, or id change).
    // This guards against double-firing when both initialize() and the
    // onAuthStateChange SIGNED_IN event both call set({ user }) in quick
    // succession with the same user.
    if (currentUserId && currentUserId !== prevUserId) {
      const now = Date.now();

      // Read persisted timestamps from AsyncStorage so the 30-min debounce
      // survives app restarts. In-memory lastSyncedAt is always null after a
      // cold start even when a recent sync was persisted to storage.
      const [filterStoredStr, onboardingStoredStr] = await Promise.all([
        AsyncStorage.getItem(FILTER_LAST_SYNCED_KEY).catch(() => null),
        AsyncStorage.getItem(ONBOARDING_LAST_SYNCED_KEY).catch(() => null),
      ]);

      const filterLastSync = filterStoredStr
        ? Math.max(Number(filterStoredStr), useFilterStore.getState().lastSyncedAt ?? 0)
        : useFilterStore.getState().lastSyncedAt;
      const onboardingLastSync = onboardingStoredStr
        ? Math.max(Number(onboardingStoredStr), useOnboardingStore.getState().lastSyncedAt ?? 0)
        : useOnboardingStore.getState().lastSyncedAt;

      // Skip sync if last sync was within 30 minutes (e.g. app foreground or restart)
      if (!filterLastSync || now - filterLastSync >= SYNC_DEBOUNCE_MS) {
        useFilterStore.getState().syncWithDatabase(currentUserId);
      } else {
        // Restore persisted timestamp into memory so subsequent checks within
        // this session don't re-read AsyncStorage unnecessarily.
        useFilterStore.setState({ lastSyncedAt: filterLastSync });
      }

      if (!onboardingLastSync || now - onboardingLastSync >= SYNC_DEBOUNCE_MS) {
        useOnboardingStore.getState().loadUserPreferences(currentUserId);
      } else {
        useOnboardingStore.setState({ lastSyncedAt: onboardingLastSync });
      }
    }

    prevUserId = currentUserId;
  });

  return unsubscribe;
}
