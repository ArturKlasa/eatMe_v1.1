import Link from 'next/link';
import { SignInForm } from '@/components/auth/SignInForm';

interface Props {
  searchParams: Promise<{ redirect?: string; error?: string }>;
}

export default async function SignInPage({ searchParams }: Props) {
  const { redirect, error } = await searchParams;
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Sign in</h1>
          <p className="text-sm text-muted-foreground mt-1">Welcome back to EatMe Portal</p>
        </div>
        <SignInForm redirectTo={redirect} initialError={error} />
        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="underline font-medium">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
