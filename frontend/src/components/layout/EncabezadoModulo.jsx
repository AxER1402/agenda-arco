import { cn } from '@/lib/utils';

/**
 * Cabecera de módulo: el titular de la página, su descripción y las acciones.
 *
 * Sin franja de color ni bloque de icono. En shadcn la cabecera de una página
 * no es una pieza con fondo propio: es texto y botones sobre el lienzo, y lo
 * que la separa del contenido es el espacio. El icono se conserva porque
 * identifica la sección de un vistazo, pero va suelto y en el gris secundario,
 * no dentro de un cuadrado de color.
 *
 * La descripción se recibe como nodo y se pinta aquí, en el gris secundario del
 * tema, para que todas las páginas la den igual.
 */
function EncabezadoModulo({ icono: Icono, titulo, descripcion, acciones, className }) {
  return (
    <header className={cn('flex flex-wrap items-start justify-between gap-4', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {Icono && (
          <Icono className="mt-1 hidden size-7 shrink-0 text-muted-foreground sm:block" aria-hidden="true" />
        )}

        <div className="min-w-0">
          <h1 className="text-2xl leading-tight sm:text-3xl">{titulo}</h1>
          {descripcion && (
            <div className="mt-1.5 max-w-prose text-sm leading-relaxed text-muted-foreground">
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
 * Titular de sección: el que abre cada bloque de una página larga.
 *
 * Va desnudo, sin marca de color a la izquierda. Esa barrita era el único sitio
 * donde el acento salía dentro del contenido, y con canto vivo se leía como una
 * raya suelta antes del texto en vez de como un adorno. Lo que separa un bloque
 * del anterior es el espacio.
 */
function TituloSeccion({ children, className, ...props }) {
  return (
    <h2 className={cn('text-xl', className)} {...props}>
      {children}
    </h2>
  );
}

export default EncabezadoModulo;
export { TituloSeccion };
