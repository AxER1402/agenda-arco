import { cn } from '@/lib/utils';

/**
 * Tabla de shadcn.
 *
 * El contenedor lleva el borde, el canto y el scroll horizontal; la tabla va
 * dentro. El radio se recorta solo, porque el `overflow` del contenedor ya
 * recorta las esquinas de la primera y la última fila.
 */
function Table({ className, ...props }) {
  return (
    <div className="w-full overflow-x-auto rounded-xl border bg-card">
      <table className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  );
}

/** Cabecera en el gris suave del tema, como la de la librería. */
function TableHeader({ className, ...props }) {
  return <thead className={cn('[&_tr]:border-b [&_tr]:bg-muted/60', className)} {...props} />;
}

function TableBody({ className, ...props }) {
  return <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />;
}

function TableRow({ className, ...props }) {
  return (
    <tr className={cn('border-b border-linea transition-colors hover:bg-muted/50', className)} {...props} />
  );
}

function TableHead({ className, ...props }) {
  return (
    <th
      className={cn(
        'h-11 whitespace-nowrap px-4 text-left align-middle text-sm font-normal text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }) {
  return <td className={cn('px-4 py-3 align-middle', className)} {...props} />;
}

function TableEmpty({ colSpan, children }) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="py-14 text-center text-muted-foreground">
        {children}
      </TableCell>
    </TableRow>
  );
}

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty };
