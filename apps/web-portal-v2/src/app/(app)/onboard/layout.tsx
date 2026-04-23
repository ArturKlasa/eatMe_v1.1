import { redirect } from 'next/navigation';
import { verifySession } from '@/lib/auth/dal';
import { createServerClient } from '@/lib/supabase/server';

export default async function OnboardLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await verifySession();
  const supabase = await createServerClient();
  const { data: restaurants } = await supabase
    .from('restaurants')
    .select('id, status')
    .eq('owner_id', userId)
    .limit(1);
  // If restaurant is published or archived, redirect to the restaurant page
  if (restaurants?.length && restaurants[0].status !== 'draft') {
    redirect(`/restaurant/${restaurants[0].id}`);
  }
  return <>{children}</>;
}
