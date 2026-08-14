import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combina clases de Tailwind resolviendo conflictos.
 * Es la utilidad que esperan todos los componentes de shadcn/ui.
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
