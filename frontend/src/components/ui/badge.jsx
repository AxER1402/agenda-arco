import { cva } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/**
 * Insignia de shadcn con tres variantes añadidas.
 *
 * `success`, `warning` y la `destructive` suave no están en la librería: hacen
 * falta para los estados de cita y los avisos de vigencia de las órdenes. Van
 * con relleno claro y el texto en el tono fuerte del color —no en blanco sobre
 * saturado, que en cuerpo 11 se lee mal—, igual que `secondary` en la librería.
 *
 * El resto son las de shadcn tal cual, `default` incluida: casi negro con el
 * texto en claro.
 */
const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium [&>svg]:pointer-events-none [&>svg]:size-3',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-destructive/20 bg-destructive-suave text-destructive',
        success: 'border-success/20 bg-success-suave text-success',
        warning: 'border-warning/20 bg-warning-suave text-warning',
        outline: 'text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function Badge({ className, variant, ...props }) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
