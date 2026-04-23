import { NextRequest, NextResponse } from 'next/server';
import { withPublicRoute } from '@/lib/auth/route-wrappers';

export const GET = withPublicRoute(async ({ supabase }, req: NextRequest) => {
  const { searchParams } = req.nextUrl;
  const providerError = searchParams.get('error');
  if (providerError) {
    const desc = searchParams.get('error_description') ?? providerError;
    return NextResponse.redirect(new URL(`/signin?error=${encodeURIComponent(desc)}`, req.url));
  }

  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/restaurant';
  const redirectTo = next.startsWith('/') && !next.startsWith('//') ? next : '/restaurant';

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        new URL(`/signin?error=${encodeURIComponent(error.message)}`, req.url)
      );
    }
  }

  return NextResponse.redirect(new URL(redirectTo, req.url));
});
