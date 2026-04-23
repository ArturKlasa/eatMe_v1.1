import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';

export const verifySession = cache(async () => {
  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data) redirect('/signin');
  return { userId: data!.claims.sub, claims: data!.claims };
});
