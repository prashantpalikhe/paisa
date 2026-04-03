/**
 * Utility functions used by shadcn-vue components.
 *
 * `cn()` merges Tailwind CSS classes intelligently:
 * - Deduplicates conflicting utilities (e.g., `p-2 p-4` → `p-4`)
 * - Supports conditional classes via clsx syntax
 *
 * Example:
 *   cn('p-2 bg-red-500', isActive && 'bg-blue-500')
 *   // → 'p-2 bg-blue-500' (when isActive is true)
 */
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
