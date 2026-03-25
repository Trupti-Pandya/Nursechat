import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Combines multiple class names using clsx and tailwind-merge
 * 
 * This utility function merges CSS class names and handles Tailwind class conflicts
 * by properly merging the classes and keeping the last conflicting class.
 * 
 * @param inputs - Array of class names or conditional class objects
 * @returns Merged class string with conflicts resolved
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
