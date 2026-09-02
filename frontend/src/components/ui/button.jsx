import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/**
 * Botones planos de canto vivo. Sin sombra ni desplazamiento: lo que distingue
 * una acción de una superficie es el relleno.
 *
 * La respuesta a la pulsación es un cambio de tono, no una inversión de relleno
 * y texto: el botón se oscurece un punto y nada más. Son 100 ms y no mueve nada
 * de sitio, así que en una tabla densa la fila no baila bajo el cursor.
 */
const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-none border-2',
    'font-semibold transition-colors duration-100 ease-out',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    'disabled:pointer-events-none disabled:opacity-45',
    '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        default: 'border-trazo bg-primary text-primary-foreground hover:bg-primary-hover',
        destructive:
          'border-trazo bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border-trazo bg-card text-titular hover:bg-secondary',
        secondary: 'border-trazo bg-accent text-accent-foreground hover:bg-accent-hover',
        ghost: 'border-transparent text-foreground hover:border-trazo hover:bg-secondary hover:text-titular',
        link: 'border-transparent text-titular underline decoration-primary decoration-2 underline-offset-4 hover:decoration-titular',
      },
      size: {
        default: 'h-10 px-5 text-sm',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-12 px-7 text-base',
        icon: 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({ className, variant, size, asChild = false, ...props }) {
  const Comp = asChild ? Slot : 'button';

  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
