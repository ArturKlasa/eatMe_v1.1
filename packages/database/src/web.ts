// packages/database/src/web.ts
import {
  createServerClient as _createServerClient,
  createBrowserClient as _createBrowserClient,
} from '@supabase/ssr';
import type { Database } from './types';

type CookieStore = {
  getAll: () => { name: string; value: string }[];
  setAll: (cookies: { name: string; value: string; options?: Record<string, unknown> }[]) => void;
};

export function createBrowserClient(url: string, anonKey: string) {
  return _createBrowserClient<Database>(url, anonKey);
}

export function createServerClient(url: string, anonKey: string, cookieStore: CookieStore) {
  return _createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: toSet => {
        try {
          cookieStore.setAll(toSet);
        } catch {
          // Server Components cannot set cookies; proxy handles refresh.
        }
      },
    },
  });
}

export function createServerActionClient(url: string, anonKey: string, cookieStore: CookieStore) {
  return _createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: toSet => cookieStore.setAll(toSet),
    },
  });
}
