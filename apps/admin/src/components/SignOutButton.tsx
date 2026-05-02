'use client';

import { useState } from 'react';
import { Loader2, LogOut } from 'lucide-react';
import { Button } from '@eatme/ui';
import { supabase } from '@/lib/supabase/browser';

type Props = {
  email?: string | null;
};

export function SignOutButton({ email }: Props) {
  const [signingOut, setSigningOut] = useState(false);

  async function handleClick() {
    setSigningOut(true);
    await supabase.auth.signOut();
    // Hard navigation so the proxy re-runs with the cleared cookie and lands
    // the user on /signin instead of looping through a stale client cache.
    window.location.href = '/signin';
  }

  return (
    <div className="flex items-center gap-3">
      {email && (
        <span className="hidden sm:inline text-xs text-muted-foreground" title={email}>
          {email}
        </span>
      )}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          handleClick().catch(() => setSigningOut(false));
        }}
        disabled={signingOut}
        aria-label="Sign out"
        className="gap-2"
      >
        {signingOut ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
        <span className="hidden sm:inline">Sign out</span>
      </Button>
    </div>
  );
}
