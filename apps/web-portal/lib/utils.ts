import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS class names safely.
 * Uses clsx to handle conditional/array inputs, then twMerge to resolve
 * conflicting Tailwind utilities (e.g. `p-2` + `p-4` → `p-4`).
 *
 * @example cn("p-2 text-red-500", condition && "text-blue-500") → "p-2 text-blue-500"
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
