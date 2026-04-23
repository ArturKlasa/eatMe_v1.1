'use client';

import React, { useState } from 'react';
import { cn } from '../lib/utils';

export interface StepConfig {
  label: string;
}

export interface OnboardingStepperProps {
  steps: StepConfig[];
  initialStep?: number;
  children: React.ReactNode[];
  /** Per-step validity. Undefined = valid (Next enabled). False = invalid (Next disabled). */
  stepValidity?: Array<boolean | undefined>;
  onStepChange?: (step: number) => void;
}

export function OnboardingStepper({
  steps,
  initialStep = 0,
  children,
  stepValidity = [],
  onStepChange,
}: OnboardingStepperProps) {
  const [current, setCurrent] = useState(Math.min(initialStep, steps.length - 1));

  const isNextDisabled = stepValidity[current] === false;

  const go = (next: number) => {
    setCurrent(next);
    onStepChange?.(next);
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4" data-testid="onboarding-stepper">
      {/* Step indicators */}
      <nav aria-label="Onboarding steps" className="mb-8">
        <ol className="flex items-center">
          {steps.map((step, i) => (
            <React.Fragment key={step.label}>
              <li className="flex flex-col items-center">
                <div
                  aria-current={i === current ? 'step' : undefined}
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors',
                    i < current && 'bg-green-500 text-white',
                    i === current && 'bg-primary text-primary-foreground ring-2 ring-primary/30',
                    i > current && 'bg-muted text-muted-foreground'
                  )}
                >
                  {i < current ? '✓' : i + 1}
                </div>
                <span
                  className={cn(
                    'mt-1 text-xs whitespace-nowrap',
                    i === current ? 'text-foreground font-medium' : 'text-muted-foreground'
                  )}
                >
                  {step.label}
                </span>
              </li>
              {i < steps.length - 1 && (
                <div
                  className={cn(
                    'flex-1 h-px mx-2 mb-4 transition-colors',
                    i < current ? 'bg-green-500' : 'bg-border'
                  )}
                />
              )}
            </React.Fragment>
          ))}
        </ol>
      </nav>

      {/* Step content */}
      <div className="min-h-[360px]">{children[current]}</div>

      {/* Navigation */}
      <div className="flex justify-between mt-8 pt-4 border-t border-border">
        <button
          type="button"
          onClick={() => go(current - 1)}
          disabled={current === 0}
          className="px-4 py-2 rounded-md border border-border text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted transition-colors"
        >
          Back
        </button>
        {current < steps.length - 1 ? (
          <button
            type="button"
            onClick={() => go(current + 1)}
            disabled={isNextDisabled}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            onClick={() => go(current + 1)}
            disabled={isNextDisabled}
            className="px-4 py-2 rounded-md bg-green-600 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-green-700 transition-colors"
          >
            Finish
          </button>
        )}
      </div>
    </div>
  );
}
