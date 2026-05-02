import { Suspense } from 'react';
import { SignInForm } from './SignInForm';

export default function SignInPage() {
  return (
    <Suspense fallback={<SignInFallback />}>
      <SignInForm />
    </Suspense>
  );
}

function SignInFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="text-sm text-muted-foreground">Loading…</div>
    </main>
  );
}
