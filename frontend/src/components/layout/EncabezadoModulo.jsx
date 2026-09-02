import { cn } from '@/lib/utils';

/**
 * Cabecera de módulo: la franja de bruma que abre cada sección.
 *
 * Es la pieza que reparte el color en el interior de la aplicación: la franja
 * en bruma y el bloque del icono en tinta oscura. Todo lo que viene debajo
 * —tarjetas y tablas— es papel, así que el color queda acotado a la apertura
 * de la página y no compite con los datos.
 *
 * La descripción se recibe como nodo y se pinta aquí: sobre la bruma, el gris
 * de `text-muted-foreground` que usaban las páginas se quedaba corto de
 * contraste.
 */
function EncabezadoModulo({ icono: Icono, titulo, descripcion, acciones, className }) {
  return (
    <header
      className={cn(
        'flex flex-wrap items-center justify-between gap-4 border-2 border-trazo bg-accent px-5 py-5 sm:px-6',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-4">
        {Icono && (
          <span className="hidden size-12 shrink-0 items-center justify-center bg-abismo text-papel sm:flex">
            <Icono className="size-6" aria-hidden="true" />
          </span>
        )}

        <div className="min-w-0">
          <h1 className="text-2xl leading-none sm:text-3xl">{titulo}</h1>
          {descripcion && (
            <div className="mt-2 max-w-prose text-sm leading-relaxed text-accent-foreground/85">
              {descripcion}
            </div>
          )}
        </div>
      </div>

      {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
    </header>
  );
}

/**
 * Titular de sección con una marca turquesa estrecha a la izquierda.
 *
 * Reaparece en cada bloque de una página larga: es la única gota de color del
 * contenido, y por eso se mantiene fina.
 */
function TituloSeccion({ children, className, ...props }) {
  return (
    <h2 className={cn('flex items-center gap-2.5 text-xl', className)} {...props}>
      <span className="h-5 w-1.5 shrink-0 bg-primary" aria-hidden="true" />
      {children}
    </h2>
  );
}

export default EncabezadoModulo;
export { TituloSeccion };
