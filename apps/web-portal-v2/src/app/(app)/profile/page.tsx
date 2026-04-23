import { createServerClient } from '@/lib/supabase/server';
import { verifySession } from '@/lib/auth/dal';

export default async function ProfilePage() {
  await verifySession();
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="max-w-md space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Profile</h1>
        <p className="text-sm text-muted-foreground">Manage your account details.</p>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">Email</div>
        <div className="text-sm text-muted-foreground border rounded px-3 py-2">
          {user?.email ?? '—'}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Password change and OAuth link management coming soon.
      </p>
    </div>
  );
}
