import { describe, it, expect } from 'vitest';
import type { OnboardingStepperProps } from '../compose/OnboardingStepper';

describe('OnboardingStepper export', () => {
  it('exports OnboardingStepper', async () => {
    const mod = await import('../compose/OnboardingStepper');
    expect(mod.OnboardingStepper).toBeDefined();
    expect(typeof mod.OnboardingStepper).toBe('function');
  });

  it('re-exports OnboardingStepper from index', async () => {
    const mod = await import('../index');
    expect(mod.OnboardingStepper).toBeDefined();
    expect(typeof mod.OnboardingStepper).toBe('function');
  });

  it('OnboardingStepperProps accepts onFinish callback', () => {
    // TypeScript compile-time check: this assignment is only valid if onFinish
    // is a recognised (optional) key on OnboardingStepperProps.
    const onFinishSpy = () => {};
    const props: OnboardingStepperProps = {
      steps: [{ label: 'Step 1' }],
      children: [],
      onFinish: onFinishSpy,
    };
    expect(props.onFinish).toBe(onFinishSpy);
  });

  it('OnboardingStepperProps allows onFinish to be omitted', () => {
    const props: OnboardingStepperProps = {
      steps: [],
      children: [],
    };
    expect(props.onFinish).toBeUndefined();
  });
});
