'use client';

import { useTransition, useState } from 'react';
import { z } from 'zod';
import { signInWithPassword, signInWithGoogle, signInWithFacebook } from '@/app/(auth)/actions';

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type FormState = { email: string; password: string };

export function SignInForm({ redirectTo }: { redirectTo?: string }) {
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<FormState>({ email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormState, string[]>>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const result = schema.safeParse(form);
    if (!result.success) {
      setFieldErrors(result.error.flatten().fieldErrors as typeof fieldErrors);
      return;
    }

    const fd = new FormData();
    fd.set('email', form.email);
    fd.set('password', form.password);
    if (redirectTo) fd.set('redirect', redirectTo);

    startTransition(async () => {
      const res = await signInWithPassword(fd);
      if (res && !res.ok) {
        setFormError(res.formError ?? 'Sign in failed');
        if ('fieldErrors' in res && res.fieldErrors) {
          setFieldErrors(res.fieldErrors as typeof fieldErrors);
        }
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-1">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={e => setForm(s => ({ ...s, email: e.target.value }))}
          className="w-full border rounded px-3 py-2 text-sm"
          disabled={isPending}
        />
        {fieldErrors.email?.map(e => (
          <p key={e} className="text-destructive text-xs mt-1">
            {e}
          </p>
        ))}
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium mb-1">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={form.password}
          onChange={e => setForm(s => ({ ...s, password: e.target.value }))}
          className="w-full border rounded px-3 py-2 text-sm"
          disabled={isPending}
        />
        {fieldErrors.password?.map(e => (
          <p key={e} className="text-destructive text-xs mt-1">
            {e}
          </p>
        ))}
      </div>

      {formError && <p className="text-destructive text-sm">{formError}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-primary text-primary-foreground rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {isPending ? 'Signing in…' : 'Sign in'}
      </button>

      <div className="relative my-2">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">or continue with</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await signInWithGoogle();
            })
          }
          className="border rounded px-4 py-2 text-sm disabled:opacity-50"
        >
          Google
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await signInWithFacebook();
            })
          }
          className="border rounded px-4 py-2 text-sm disabled:opacity-50"
        >
          Facebook
        </button>
      </div>
    </form>
  );
}
