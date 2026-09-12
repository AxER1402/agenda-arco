import { cn } from '@/lib/utils';

/**
 * Campo de shadcn. Fondo transparente y borde de un pixel: dentro de una
 * tarjeta blanca, el campo se distingue por el contorno, no por el relleno.
 *
 * Lo único que cambia respecto a la librería es el alto —44 px en vez de 36—,
 * que es el objetivo táctil mínimo de un mostrador donde se teclea de pie.
 */
function Input({ className, type = 'text', ...props }) {
  return (
    <input
      type={type}
      className={cn(
        'flex h-11 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none transition-[color,box-shadow] md:text-sm',
        'placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground',
        'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
        'aria-invalid:border-destructive aria-invalid:ring-destructive/20',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
