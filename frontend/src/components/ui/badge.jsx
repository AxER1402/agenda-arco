import { cva } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/**
 * Las variantes `success` y `warning` existen para los estados de cita y los
 * avisos de vigencia de las órdenes; se añaden a las de shadcn.
 *
 * Rectángulos planos de canto vivo: relleno pastel, trazo del mismo color en
 * tono fuerte y ese mismo tono en el texto. Evita el texto blanco sobre fondo
 * saturado —que en cuerpo 11 se lee mal— y deja el turquesa de marca reservado
 * para las acciones.
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-none border px-2 py-0.5 text-xs font-semibold tracking-tight whitespace-nowrap',
  {
    variants: {
      variant: {
        default: 'border-trazo bg-accent text-accent-foreground',
        secondary: 'border-trazo bg-secondary text-secondary-foreground',
        destructive: 'border-destructive bg-destructive-suave text-destructive',
        success: 'border-success bg-success-suave text-success',
        warning: 'border-warning bg-warning-suave text-warning',
        outline: 'border-trazo bg-transparent text-titular',
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
