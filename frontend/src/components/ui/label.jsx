import * as LabelPrimitive from '@radix-ui/react-label';

import { cn } from '@/lib/utils';

/**
 * Etiqueta menuda en versalitas y en el color de los titulares. Contrasta en tamaño con el
 * campo que rotula, así el formulario se lee de un vistazo sin subrayar cada
 * nombre con negrita.
 */
function Label({ className, ...props }) {
  return (
    <LabelPrimitive.Root
      className={cn(
        'text-xs font-semibold uppercase leading-none tracking-[0.07em] text-titular',
        'peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
        className,
      )}
      {...props}
    />
  );
}

export { Label };
