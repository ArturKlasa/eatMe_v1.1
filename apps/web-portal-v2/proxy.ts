import { NextResponse, type NextRequest } from 'next/server';
import { createAuthProxy } from '@eatme/shared/auth/proxy';

const handler = createAuthProxy({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  appRoutes: ['/onboard', '/restaurant', '/profile'],
  authRoutes: ['/signin', '/signup'],
  postAuthPath: '/restaurant',
  NextResponse,
});

export const proxy = (req: NextRequest) => handler(req);

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|svg)).*)'],
};
