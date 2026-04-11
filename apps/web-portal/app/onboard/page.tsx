'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OnboardPage() {
  const router = useRouter();

  useEffect(() => {
    router.push('/onboard/basic-info');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground">Redirecting to onboarding...</p>
    </div>
  );
}
