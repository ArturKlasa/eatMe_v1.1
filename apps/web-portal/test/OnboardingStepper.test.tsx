import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { OnboardingStepper, ONBOARDING_STEPS } from '@/components/OnboardingStepper';

// Mock next/link to render a plain anchor
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

describe('OnboardingStepper', () => {
  it('renders all 3 step labels', () => {
    render(<OnboardingStepper currentStep={1} steps={ONBOARDING_STEPS} />);
    expect(screen.getByText('Basic Info')).toBeInTheDocument();
    expect(screen.getByText('Menu')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
  });

  it('highlights the current step', () => {
    render(<OnboardingStepper currentStep={2} steps={ONBOARDING_STEPS} />);
    const currentIndicator = screen.getByText('2');
    expect(currentIndicator).toHaveAttribute('aria-current', 'step');
  });

  it('completed steps are rendered as links', () => {
    render(<OnboardingStepper currentStep={3} steps={ONBOARDING_STEPS} />);
    // Steps 1 and 2 are completed — should be links
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute('href', '/onboard/basic-info');
    expect(links[1]).toHaveAttribute('href', '/onboard/menu');
  });

  it('future steps are not links', () => {
    render(<OnboardingStepper currentStep={1} steps={ONBOARDING_STEPS} />);
    const links = screen.queryAllByRole('link');
    expect(links).toHaveLength(0);
  });

  it('current step is not a link', () => {
    render(<OnboardingStepper currentStep={2} steps={ONBOARDING_STEPS} />);
    // Only step 1 should be a link
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', '/onboard/basic-info');
  });

  it('renders step descriptions', () => {
    render(<OnboardingStepper currentStep={1} steps={ONBOARDING_STEPS} />);
    expect(screen.getByText('Restaurant details')).toBeInTheDocument();
    expect(screen.getByText('Add your dishes')).toBeInTheDocument();
    expect(screen.getByText('Review & submit')).toBeInTheDocument();
  });
});
