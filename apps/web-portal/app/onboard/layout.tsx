'use client';

import { usePathname } from 'next/navigation';
import { OnboardingStepper, ONBOARDING_STEPS } from '@/components/OnboardingStepper';

function getStepFromPathname(pathname: string): 1 | 2 | 3 {
  if (pathname.startsWith('/onboard/menu')) return 2;
  if (pathname.startsWith('/onboard/review')) return 3;
  return 1;
}

export default function OnboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const currentStep = getStepFromPathname(pathname);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-8">
        <OnboardingStepper currentStep={currentStep} steps={ONBOARDING_STEPS} />
      </div>
      {children}
    </div>
  );
}

export { getStepFromPathname };
