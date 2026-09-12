import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EllipsisVertical } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Menú de acciones secundarias.
 *
 * Existe para que una fila de tabla no acumule cinco botones: si se envuelven,
 * la fila crece y las acciones se apilan unas sobre otras. Aquí solo queda a la
 * vista la acción principal y el resto vive detrás de este botón.
 *
 * El panel se dibuja en un portal con posición fija porque la tabla vive dentro
 * de un contenedor con scroll propio, y un panel absoluto quedaría recortado por
 * ese borde. Al desplazar o redimensionar se cierra en lugar de recalcularse:
 * un menú que persigue a su botón mientras la página se mueve distrae más de lo
 * que ayuda.
 */
function MenuAcciones({ etiqueta = 'Más acciones', disabled = false, children }) {
  const [abierto, setAbierto] = useState(false);
  const [posicion, setPosicion] = useState(null);

  const disparador = useRef(null);
  const panel = useRef(null);

  function cerrar({ devolverFoco = false } = {}) {
    setAbierto(false);
    if (devolverFoco) disparador.current?.focus();
  }

  // La posición se mide después de pintar, cuando el panel ya tiene tamaño.
  useLayoutEffect(() => {
    if (!abierto || !disparador.current) return;

    const marco = disparador.current.getBoundingClientRect();
    const alto = panel.current?.offsetHeight ?? 0;

    // Si no cabe debajo, se abre hacia arriba.
    const cabeDebajo = marco.bottom + alto + 8 <= window.innerHeight;

    setPosicion({
      top: cabeDebajo ? marco.bottom + 4 : Math.max(marco.top - alto - 4, 8),
      right: Math.max(window.innerWidth - marco.right, 8),
    });
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return undefined;

    function alPulsarFuera(evento) {
      if (
        !panel.current?.contains(evento.target) &&
        !disparador.current?.contains(evento.target)
      ) {
        cerrar();
      }
    }

    function alPulsarTecla(evento) {
      if (evento.key === 'Escape') cerrar({ devolverFoco: true });
    }

    const alMover = () => cerrar();

    document.addEventListener('mousedown', alPulsarFuera);
    document.addEventListener('keydown', alPulsarTecla);
    window.addEventListener('resize', alMover);
    // `true` para enterarse también del scroll de la propia tabla.
    window.addEventListener('scroll', alMover, true);

    return () => {
      document.removeEventListener('mousedown', alPulsarFuera);
      document.removeEventListener('keydown', alPulsarTecla);
      window.removeEventListener('resize', alMover);
      window.removeEventListener('scroll', alMover, true);
    };
  }, [abierto]);

  return (
    <>
      <Button
        ref={disparador}
        type="button"
        size="icon"
        variant="ghost"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={abierto}
        title={etiqueta}
        onClick={() => setAbierto((visible) => !visible)}
      >
        <EllipsisVertical aria-hidden="true" />
        <span className="sr-only">{etiqueta}</span>
      </Button>

      {abierto &&
        createPortal(
          <div
            ref={panel}
            role="menu"
            aria-label={etiqueta}
            className={cn(
              'superficie-flotante fixed z-50 flex min-w-52 flex-col rounded-md border p-1 text-popover-foreground shadow-md',
              posicion ? 'visible' : 'invisible',
            )}
            style={{ top: posicion?.top ?? 0, right: posicion?.right ?? 0 }}
            // Cualquier opción cierra el menú: el manejador de la opción se
            // ejecuta primero y el evento llega aquí después.
            onClick={() => cerrar({ devolverFoco: true })}
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}

/** Opción del menú. `variante="destructiva"` para lo que no tiene vuelta atrás. */
function OpcionMenu({ icono: Icono, variante, className, children, ...props }) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cn(
        'flex w-full select-none items-center gap-2.5 rounded-sm px-2 py-2 text-left text-sm outline-none',
        'transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent',
        'disabled:pointer-events-none disabled:opacity-50',
        variante === 'destructiva' ? 'text-destructive hover:bg-destructive-suave' : 'text-foreground',
        className,
      )}
      {...props}
    >
      {Icono && <Icono className="size-4 shrink-0" aria-hidden="true" />}
      {children}
    </button>
  );
}

/** Separador entre grupos de opciones. */
function SeparadorMenu() {
  return <div className="-mx-1 my-1 h-px bg-border" role="separator" />;
}

export { MenuAcciones, OpcionMenu, SeparadorMenu };
