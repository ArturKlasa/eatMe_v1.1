'use client';

import { useTransition, useState } from 'react';
import { z } from 'zod';
import { signUpWithPassword } from '@/app/(auth)/actions';

const schema = z
  .object({
    email: z.string().email('Invalid email'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirm: z.string(),
  })
  .refine(d => d.password === d.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  });

type FormState = { email: string; password: string; confirm: string };

export function SignUpForm() {
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<FormState>({ email: '', password: '', confirm: '' });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string[]>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const result = schema.safeParse(form);
    if (!result.success) {
      setFieldErrors(result.error.flatten().fieldErrors);
      return;
    }

    const fd = new FormData();
    fd.set('email', form.email);
    fd.set('password', form.password);

    startTransition(async () => {
      const res = await signUpWithPassword(fd);
      if (!res) return;
      if (!res.ok) {
        setFormError(res.formError ?? 'Sign up failed');
        if ('fieldErrors' in res && res.fieldErrors) {
          setFieldErrors(res.fieldErrors);
        }
        return;
      }
      if (res.data.needsEmailConfirmation) {
        setCheckEmail(true);
      }
    });
  };

  if (checkEmail) {
    return (
      <div className="text-center space-y-2">
        <p className="font-medium">Check your email</p>
        <p className="text-sm text-muted-foreground">
          We sent a confirmation link to <strong>{form.email}</strong>. Click it to activate your
          account.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="su-email" className="block text-sm font-medium mb-1">
          Email
        </label>
        <input
          id="su-email"
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
        <label htmlFor="su-password" className="block text-sm font-medium mb-1">
          Password
        </label>
        <input
          id="su-password"
          type="password"
          autoComplete="new-password"
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

      <div>
        <label htmlFor="su-confirm" className="block text-sm font-medium mb-1">
          Confirm password
        </label>
        <input
          id="su-confirm"
          type="password"
          autoComplete="new-password"
          value={form.confirm}
          onChange={e => setForm(s => ({ ...s, confirm: e.target.value }))}
          className="w-full border rounded px-3 py-2 text-sm"
          disabled={isPending}
        />
        {fieldErrors.confirm?.map(e => (
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
        {isPending ? 'Creating account…' : 'Create account'}
      </button>
    </form>
  );
}
