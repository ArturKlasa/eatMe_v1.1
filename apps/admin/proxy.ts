import { NextResponse, type NextRequest } from 'next/server';
import { createAuthProxy } from '@eatme/shared/auth/proxy';

const handler = createAuthProxy({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  appRoutes: ['/restaurants', '/menu-scan', '/imports', '/audit'],
  authRoutes: ['/signin'],
  adminOnly: ['/'],
  postAuthPath: '/restaurants',
  forbiddenPath: '/signin?forbidden=1',
  NextResponse,
});

export const proxy = (req: NextRequest) => handler(req);

export const config = {
  // Exclude /signin to prevent redirect loops when adminOnly: ['/'] is set
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|signin|.*\\.(?:png|jpg|svg)).*)'],
};
