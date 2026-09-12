import { cva } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/**
 * Aviso de shadcn, con las variantes de estado del sistema.
 *
 * El `default` es el de la librería: fondo de tarjeta y borde, sin color. Los
 * tres de estado llevan relleno claro y el texto en el tono fuerte, que es lo
 * que los hace distinguibles de un vistazo sin que griten.
 */
const alertVariants = cva(
  'relative w-full rounded-lg border px-4 py-3 text-sm leading-relaxed [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-3.5 [&>svg]:size-4 [&>svg~*]:pl-7',
  {
    variants: {
      variant: {
        default: 'bg-card text-card-foreground',
        destructive: 'border-destructive/20 bg-destructive-suave text-destructive',
        warning: 'border-warning/20 bg-warning-suave text-warning',
        success: 'border-success/20 bg-success-suave text-success',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

function Alert({ className, variant, ...props }) {
  return <div role="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
}

function AlertTitle({ className, ...props }) {
  return <h5 className={cn('mb-1 text-base leading-none text-current', className)} {...props} />;
}

function AlertDescription({ className, ...props }) {
  return <div className={cn('text-sm [&_p]:leading-relaxed', className)} {...props} />;
}

export { Alert, AlertTitle, AlertDescription };
