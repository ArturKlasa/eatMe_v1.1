'use client';

export default function MenuManagePage() {
  // Redirect to existing menu page for now
  if (typeof window !== 'undefined') {
    window.location.href = '/onboard/menu';
  }
  return null;
}
