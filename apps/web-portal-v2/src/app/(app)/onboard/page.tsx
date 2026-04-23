import { redirect } from 'next/navigation';
import { verifySession } from '@/lib/auth/dal';
import { createServerClient } from '@/lib/supabase/server';

export default async function OnboardPage() {
  const { userId } = await verifySession();
  const supabase = await createServerClient();

  const { data: restaurants } = await supabase
    .from('restaurants')
    .select('id')
    .eq('owner_id', userId)
    .limit(1);

  if (restaurants && restaurants.length > 0) {
    redirect(`/restaurant/${restaurants[0].id}`);
  }

  return (
    <div className="max-w-lg mx-auto py-12 text-center space-y-4">
      <h1 className="text-2xl font-bold">Welcome to EatMe Portal</h1>
      <p className="text-muted-foreground">Let&apos;s set up your restaurant profile.</p>
      <p className="text-sm text-muted-foreground">Onboarding stepper coming soon (Step 16).</p>
    </div>
  );
}
