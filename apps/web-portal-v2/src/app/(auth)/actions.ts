'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { withPublic } from '@/lib/auth/wrappers';

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const signInWithPassword = withPublic(async ({ supabase }, formData: FormData) => {
  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { ok: false as const, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const redirectTo = (formData.get('redirect') as string | null) ?? '/restaurant';

  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false as const, formError: error.message };

  redirect(redirectTo);
});

export const signUpWithPassword = withPublic(async ({ supabase }, formData: FormData) => {
  const parsed = signUpSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { ok: false as const, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { data, error } = await supabase.auth.signUp(parsed.data);
  if (error) return { ok: false as const, formError: error.message };

  if (data.session) redirect('/onboard');
  return { ok: true as const, data: { needsEmailConfirmation: true } };
});

export const signInWithGoogle = withPublic(async ({ supabase }) => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback` },
  });
  if (error) return { ok: false as const, formError: error.message };
  if (data.url) redirect(data.url);
  return { ok: false as const, formError: 'No OAuth URL returned' };
});

export const signInWithFacebook = withPublic(async ({ supabase }) => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'facebook',
    options: { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback` },
  });
  if (error) return { ok: false as const, formError: error.message };
  if (data.url) redirect(data.url);
  return { ok: false as const, formError: 'No OAuth URL returned' };
});
