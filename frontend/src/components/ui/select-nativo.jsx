import { ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Select nativo con el estilo del sistema.
 *
 * Se prefiere al componente de Radix en los formularios de captura: en una
 * recepción se trabaja rápido y con teclado, y el desplegable nativo del
 * sistema operativo es más ágil que uno reimplementado.
 */
function SelectNativo({ className, children, ...props }) {
  return (
    <div className="relative">
      <select
        className={cn(
          'h-11 w-full appearance-none rounded-none border-2 border-input bg-secondary px-3 pr-12 text-sm',
          'transition-colors duration-100',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      {/* Bloque turquesa pegado al canto derecho, separado por su propio trazo:
          marca el único punto de la caja que despliega algo. */}
      <span
        className="pointer-events-none absolute inset-y-0 right-0 flex w-9 items-center justify-center border-l-2 border-trazo bg-primary text-primary-foreground"
        aria-hidden="true"
      >
        <ChevronDown className="size-4" />
      </span>
    </div>
  );
}

export { SelectNativo };
