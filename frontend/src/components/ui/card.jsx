import { cn } from '@/lib/utils';

/**
 * Tarjeta de shadcn: fondo de la tarjeta, borde de un pixel, canto `xl` y una
 * sombra mínima. Lo que la separa del lienzo es el borde, no la elevación.
 */
function Card({ className, ...props }) {
  return (
    <div
      className={cn('rounded-xl border bg-card text-card-foreground shadow-sm', className)}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }) {
  return <div className={cn('flex flex-col gap-1.5 p-6', className)} {...props} />;
}

function CardTitle({ className, ...props }) {
  return <h3 className={cn('text-lg leading-tight', className)} {...props} />;
}

function CardDescription({ className, ...props }) {
  return <p className={cn('text-sm leading-relaxed text-muted-foreground', className)} {...props} />;
}

function CardContent({ className, ...props }) {
  return <div className={cn('p-6 pt-0', className)} {...props} />;
}

function CardFooter({ className, ...props }) {
  return <div className={cn('flex items-center p-6 pt-0', className)} {...props} />;
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
