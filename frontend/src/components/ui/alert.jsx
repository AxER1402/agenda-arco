import { cva } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/**
 * Cada variante usa el relleno pastel del color y su tono fuerte como trazo y
 * como texto. Un aviso no grita: lo distingue el color, no el contraste.
 */
const alertVariants = cva(
  'relative w-full rounded-none border-2 px-4 py-3 text-sm leading-relaxed [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-3.5 [&>svg]:size-4 [&>svg~*]:pl-7',
  {
    variants: {
      variant: {
        default: 'border-trazo bg-secondary text-foreground',
        destructive: 'border-destructive bg-destructive-suave text-destructive',
        warning: 'border-warning bg-warning-suave text-warning',
        success: 'border-success bg-success-suave text-success',
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
