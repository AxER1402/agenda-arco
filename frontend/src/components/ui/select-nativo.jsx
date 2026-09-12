import { ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Select nativo con el aspecto del `SelectTrigger` de shadcn.
 *
 * Se prefiere al componente de Radix en los formularios de captura: en una
 * recepción se trabaja rápido y con teclado, y el desplegable nativo del
 * sistema operativo es más ágil que uno reimplementado. Lo que se copia de
 * shadcn es el aspecto —mismo borde, mismo radio, mismo aro de foco y el galón
 * atenuado a la derecha—, no el componente.
 */
function SelectNativo({ className, children, ...props }) {
  return (
    <div className="relative">
      <select
        className={cn(
          'flex h-11 w-full appearance-none rounded-md border border-input bg-transparent px-3 pr-9 text-base shadow-xs outline-none transition-[color,box-shadow] md:text-sm',
          'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
          'aria-invalid:border-destructive aria-invalid:ring-destructive/20',
          'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      >
        {children}
      </select>

      <span
        className="pointer-events-none absolute inset-y-0 right-3 flex items-center opacity-50"
        aria-hidden="true"
      >
        <ChevronDown className="size-4" />
      </span>
    </div>
  );
}

export { SelectNativo };
