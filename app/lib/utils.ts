import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * shadcn-vue class-merge helper. Joins conditional classes (clsx) and resolves
 * Tailwind conflicts (tailwind-merge). Imported by every UI component as `cn()`.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
