import { cookies } from 'next/headers';
import { createServerClient as _cs, createServerActionClient as _csa } from '@eatme/database/web';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function createServerClient() {
  const cookieStore = await cookies();
  return _cs(URL, KEY, {
    getAll: () => cookieStore.getAll(),
    setAll: toSet =>
      toSet.forEach(c =>
        cookieStore.set(c.name, c.value, c.options as Parameters<typeof cookieStore.set>[2])
      ),
  });
}

export async function createServerActionClient() {
  const cookieStore = await cookies();
  return _csa(URL, KEY, {
    getAll: () => cookieStore.getAll(),
    setAll: toSet =>
      toSet.forEach(c =>
        cookieStore.set(c.name, c.value, c.options as Parameters<typeof cookieStore.set>[2])
      ),
  });
}

export const createRouteHandlerClient = createServerActionClient;
