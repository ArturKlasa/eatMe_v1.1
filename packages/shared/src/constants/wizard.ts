/**
 * Onboarding wizard step definitions for the restaurant registration flow.
 */

/** Step definitions for the restaurant onboarding wizard progress indicator. */
export const WIZARD_STEPS = [
  { id: 1, title: 'Basic Information', path: '/onboard/basic-info' },
  { id: 2, title: 'Operations', path: '/onboard/operations' },
  { id: 3, title: 'Menu Entry', path: '/onboard/menu' },
  { id: 4, title: 'Review & Submit', path: '/onboard/review' },
] as const;
