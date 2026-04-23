import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';

export const verifySession = cache(async () => {
  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect('/signin');
  return { userId: data.user!.id, user: data.user! };
});

export const verifyAdminSession = cache(async () => {
  const session = await verifySession();
  if (session.user.app_metadata?.role !== 'admin') redirect('/signin?forbidden=1');
  return session;
});
