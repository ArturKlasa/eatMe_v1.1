'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@eatme/ui';
import { supabase } from '@/lib/supabase/browser';
import { sanitizeRedirect } from '@/lib/auth/redirect';

const inputClass =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50';
const labelClass = 'block text-sm font-medium text-foreground mb-1.5';

export function SignInForm() {
  const searchParams = useSearchParams();
  const forbidden = searchParams.get('forbidden') === '1';
  const redirectTo = sanitizeRedirect(searchParams.get('redirect'));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  // Initial error is derived from the URL once at mount; the form clears or
  // overwrites it via setError on submit.
  const [error, setError] = useState(() => searchParams.get('error') ?? '');
  const [signingOut, setSigningOut] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // window.location ensures the proxy re-runs with the fresh session cookie,
    // which is what re-evaluates admin role for the destination route.
    window.location.href = redirectTo;
  }

  async function handleSignOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    // Strip ?forbidden=1 so the form re-renders cleanly for the next attempt.
    window.location.href = '/signin';
  }

  if (forbidden) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-md space-y-5 rounded-xl border bg-card p-8 shadow-sm">
          <div className="space-y-2">
            <h1 className="text-xl font-semibold">Not authorized</h1>
            <p className="text-sm text-muted-foreground">
              You&apos;re signed in, but this account doesn&apos;t have admin access. Sign out and
              try a different account, or contact the EatMe owner to request access.
            </p>
          </div>
          <Button
            type="button"
            className="w-full"
            onClick={() => {
              handleSignOut().catch(() => setSigningOut(false));
            }}
            disabled={signingOut}
          >
            {signingOut ? <Loader2 className="size-4 animate-spin" /> : 'Sign out'}
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-6 rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-brand-primary flex items-center justify-center">
            <span className="text-white font-bold">EM</span>
          </div>
          <div className="space-y-0.5">
            <h1 className="text-xl font-semibold leading-tight">EatMe Admin</h1>
            <p className="text-xs text-muted-foreground">Sign in to continue</p>
          </div>
        </div>

        <form
          onSubmit={e => {
            handleSubmit(e).catch(() => setLoading(false));
          }}
          className="space-y-4"
        >
          <div>
            <label htmlFor="signin-email" className={labelClass}>
              Email
            </label>
            <input
              id="signin-email"
              type="email"
              autoComplete="email"
              autoFocus
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={loading}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="signin-password" className={labelClass}>
              Password
            </label>
            <input
              id="signin-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={loading}
              className={inputClass}
            />
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading || !email || !password}>
            {loading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Signing in…
              </>
            ) : (
              'Sign in'
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Accounts are issued by the EatMe owner. Contact them if you need access or a password
            reset.
          </p>
        </form>
      </div>
    </main>
  );
}
