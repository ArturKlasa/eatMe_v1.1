'use client';

import Link from 'next/link';
import { Check } from 'lucide-react';

interface OnboardingStep {
  label: string;
  description: string;
  href: string;
}

interface OnboardingStepperProps {
  currentStep: 1 | 2 | 3;
  steps: OnboardingStep[];
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  { label: 'Basic Info', description: 'Restaurant details', href: '/onboard/basic-info' },
  { label: 'Menu', description: 'Add your dishes', href: '/onboard/menu' },
  { label: 'Review', description: 'Review & submit', href: '/onboard/review' },
];

export function OnboardingStepper({ currentStep, steps }: OnboardingStepperProps) {
  return (
    <nav aria-label="Onboarding progress" className="flex items-center justify-center w-full">
      {steps.map((step, index) => {
        const stepNumber = (index + 1) as 1 | 2 | 3;
        const isCompleted = stepNumber < currentStep;
        const isCurrent = stepNumber === currentStep;
        const isFuture = stepNumber > currentStep;

        return (
          <div key={step.href} className="flex items-center">
            {/* Step circle + label */}
            <div className="flex flex-col items-center">
              {isCompleted ? (
                <Link
                  href={step.href}
                  className="flex size-8 items-center justify-center rounded-full bg-brand-primary text-white transition-colors hover:bg-brand-primary-dark"
                  aria-label={`${step.label} (completed) - go back`}
                >
                  <Check className="size-4" />
                </Link>
              ) : (
                <div
                  className={`flex size-8 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors ${
                    isCurrent
                      ? 'border-brand-primary text-brand-primary'
                      : 'border-muted-foreground/30 text-muted-foreground/50'
                  }`}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  {stepNumber}
                </div>
              )}
              <span
                className={`mt-1.5 text-xs font-medium ${
                  isCurrent
                    ? 'text-brand-primary'
                    : isCompleted
                      ? 'text-foreground'
                      : 'text-muted-foreground/50'
                }`}
              >
                {step.label}
              </span>
              <span
                className={`hidden text-[10px] sm:block ${
                  isFuture ? 'text-muted-foreground/40' : 'text-muted-foreground'
                }`}
              >
                {step.description}
              </span>
            </div>

            {/* Connecting line */}
            {index < steps.length - 1 && (
              <div
                className={`mx-2 h-0.5 w-12 sm:mx-4 sm:w-20 ${
                  stepNumber < currentStep ? 'bg-brand-primary' : 'bg-muted-foreground/20'
                }`}
                aria-hidden="true"
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}
