import { cn } from '@/lib/utils';

/**
 * La tabla siempre va dentro de un contenedor con scroll horizontal propio.
 *
 * Trazo de 2 px por fuera; por dentro, las filas se dividen con la línea
 * diluida. Un trazo pleno en cada fila convertiría una tabla de treinta citas
 * en una reja.
 */
function Table({ className, ...props }) {
  return (
    <div className="w-full overflow-x-auto rounded-none border-2 border-border bg-card">
      <table className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  );
}

/** Cabecera en bruma: es lo que separa la tabla del papel sin gastar trazo. */
function TableHeader({ className, ...props }) {
  return (
    <thead
      className={cn(
        'bg-accent text-accent-foreground [&_tr]:border-b-2 [&_tr]:border-trazo',
        className,
      )}
      {...props}
    />
  );
}

function TableBody({ className, ...props }) {
  return <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />;
}

function TableRow({ className, ...props }) {
  return (
    <tr
      className={cn('border-b border-linea transition-colors hover:bg-secondary/70', className)}
      {...props}
    />
  );
}

/** Cabecera en versalitas menudas: contrasta con el cuerpo y no le roba peso. */
function TableHead({ className, ...props }) {
  return (
    <th
      className={cn(
        'h-11 whitespace-nowrap px-4 text-left align-middle',
        'text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-titular',
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
