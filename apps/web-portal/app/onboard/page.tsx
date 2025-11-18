'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OnboardPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to menu page for now (we can change this to basic-info when that's ready)
    router.push('/onboard/menu');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-600">Redirecting to onboarding...</p>
    </div>
  );
}
