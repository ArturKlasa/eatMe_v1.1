'use client';
import { useReviewStore } from '../store';

export function useMenuScanStep() {
  const step = useReviewStore(s => s.step);
  const setStep = useReviewStore(s => s.setStep);
  return { step, setStep };
}
