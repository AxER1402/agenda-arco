import { cn } from '@/lib/utils';

/**
 * Campo plano: línea de un píxel algo más firme que la del resto del sistema y
 * relleno gris muy claro. El relleno es lo que distingue un hueco donde se
 * escribe de una superficie de solo lectura, ahora que no hay relieve.
 */
function Input({ className, type = 'text', ...props }) {
  return (
    <input
      type={type}
      className={cn(
        'flex h-11 w-full rounded-none border-2 border-input bg-secondary px-3 text-sm',
        'transition-colors duration-100',
        'placeholder:text-muted-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-[invalid=true]:border-destructive aria-[invalid=true]:bg-destructive-suave',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
