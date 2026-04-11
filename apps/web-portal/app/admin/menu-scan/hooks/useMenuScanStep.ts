'use client';

import { useState } from 'react';
import type { Step } from './menuScanTypes';

/** Manages the step state machine: upload → processing → review → done */
export function useMenuScanStep() {
  const [step, setStep] = useState<Step>('upload');
  return { step, setStep };
}
