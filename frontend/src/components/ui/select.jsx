import { Children, isValidElement, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Desplegable con el aspecto del `Select` de shadcn.
 *
 * Sustituye al `<select>` del navegador, cuya lista abierta la dibuja el
 * sistema operativo y no se puede vestir: en cada equipo salía distinta y sin
 * nada del sistema. Este dibuja su propia lista sobre la misma superficie
 * flotante que el menú de acciones.
 *
 * Las opciones se siguen escribiendo como `<option value="…">texto</option>` y
 * `onChange` recibe `{ target: { value } }`, igual que el nativo, para que los
 * formularios no tengan que cambiar su manera de leer el valor.
 *
 * El teclado se conserva entero porque en recepción se trabaja con él: las
 * flechas cambian el valor sin abrir la lista, una letra salta a la opción que
 * empieza por ella, y con la lista abierta Enter elige y Escape cierra. El foco
 * no sale nunca del botón; la opción activa se anuncia con
 * `aria-activedescendant`.
 */
function Select({ id, value, onChange, disabled = false, placeholder = 'Seleccione', className, children, ...props }) {
  const opciones = Children.toArray(children)
    .filter((hijo) => isValidElement(hijo) && hijo.type === 'option')
    .map((hijo) => ({
      valor: String(hijo.props.value ?? ''),
      texto: hijo.props.children,
      deshabilitada: Boolean(hijo.props.disabled),
    }));

  const valorActual = String(value ?? '');
  const indiceElegido = opciones.findIndex((opcion) => opcion.valor === valorActual);

  const [abierto, setAbierto] = useState(false);
  const [activa, setActiva] = useState(-1);
  const [posicion, setPosicion] = useState(null);

  const disparador = useRef(null);
  const panel = useRef(null);
  const busqueda = useRef({ texto: '', temporizador: null });

  const idPropio = useId();
  const idLista = `${id ?? idPropio}-lista`;
  const idOpcion = (indice) => `${idLista}-${indice}`;

  function elegir(indice) {
    const opcion = opciones[indice];
    if (!opcion || opcion.deshabilitada) return;
    if (opcion.valor !== valorActual) onChange?.({ target: { value: opcion.valor } });
  }

  function abrir() {
    setActiva(indiceElegido >= 0 ? indiceElegido : siguienteHabilitada(-1, 1));
    setAbierto(true);
  }

  function cerrar({ devolverFoco = false } = {}) {
    setAbierto(false);
    setPosicion(null);
    if (devolverFoco) disparador.current?.focus();
  }

  /** La siguiente opción elegible en la dirección dada, o la de partida si no hay. */
  function siguienteHabilitada(desde, paso) {
    for (let i = desde + paso; i >= 0 && i < opciones.length; i += paso) {
      if (!opciones[i].deshabilitada) return i;
    }
    return desde;
  }

  /** Acumula lo tecleado en el último medio segundo y busca por el principio. */
  function buscarPorTexto(tecla, desde) {
    const estado = busqueda.current;
    clearTimeout(estado.temporizador);
    estado.texto += tecla.toLowerCase();
    estado.temporizador = setTimeout(() => {
      estado.texto = '';
    }, 500);

    // Con una sola letra repetida se va rotando entre las que empiezan por ella.
    const repetida = [...estado.texto].every((letra) => letra === estado.texto[0]);
    const prefijo = repetida ? estado.texto[0] : estado.texto;
    const inicio = repetida ? desde + 1 : Math.max(desde, 0);

    for (let i = 0; i < opciones.length; i += 1) {
      const indice = (inicio + i) % opciones.length;
      const opcion = opciones[indice];
      if (!opcion.deshabilitada && String(opcion.texto).toLowerCase().startsWith(prefijo)) {
        return indice;
      }
    }
    return -1;
  }

  function alPulsarTecla(evento) {
    const { key } = evento;

    if (!abierto) {
      if (key === 'ArrowDown' || key === 'ArrowUp') {
        evento.preventDefault();
        if (evento.altKey) return abrir();
        elegir(siguienteHabilitada(indiceElegido, key === 'ArrowDown' ? 1 : -1));
      } else if (key === 'Enter' || key === ' ') {
        evento.preventDefault();
        abrir();
      } else if (key.length === 1 && !evento.ctrlKey && !evento.metaKey) {
        const encontrada = buscarPorTexto(key, indiceElegido);
        if (encontrada >= 0) elegir(encontrada);
      }
      return undefined;
    }

    if (key === 'ArrowDown' || key === 'ArrowUp') {
      evento.preventDefault();
      setActiva((previa) => siguienteHabilitada(previa, key === 'ArrowDown' ? 1 : -1));
    } else if (key === 'Home' || key === 'End') {
      evento.preventDefault();
      setActiva(key === 'Home' ? siguienteHabilitada(-1, 1) : siguienteHabilitada(opciones.length, -1));
    } else if (key === 'Enter' || key === ' ') {
      evento.preventDefault();
      elegir(activa);
      cerrar();
    } else if (key === 'Escape') {
      // Sin esto, el Escape llega también al diálogo y lo cierra entero.
      evento.preventDefault();
      evento.stopPropagation();
      cerrar();
    } else if (key === 'Tab') {
      cerrar();
    } else if (key.length === 1 && !evento.ctrlKey && !evento.metaKey) {
      const encontrada = buscarPorTexto(key, activa);
      if (encontrada >= 0) setActiva(encontrada);
    }
    return undefined;
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
      left: marco.left,
      width: marco.width,
    });
  }, [abierto]);

  // La opción activa siempre a la vista cuando la lista es más alta que el panel.
  useEffect(() => {
    if (!abierto || activa < 0) return;
    document.getElementById(idOpcion(activa))?.scrollIntoView?.({ block: 'nearest' });
  }, [abierto, activa]); // eslint-disable-line react-hooks/exhaustive-deps

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

    // El scroll de la propia lista no cuenta; el de la página o el diálogo sí,
    // porque dejaría el panel flotando lejos de su campo.
    function alMover(evento) {
      if (evento?.target instanceof Node && panel.current?.contains(evento.target)) return;
      cerrar();
    }

    document.addEventListener('mousedown', alPulsarFuera);
    window.addEventListener('resize', alMover);
    window.addEventListener('scroll', alMover, true);

    return () => {
      document.removeEventListener('mousedown', alPulsarFuera);
      window.removeEventListener('resize', alMover);
      window.removeEventListener('scroll', alMover, true);
    };
  }, [abierto]);

  useEffect(() => () => clearTimeout(busqueda.current.temporizador), []);

  const elegida = opciones[indiceElegido];

  return (
    <>
      <button
        ref={disparador}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-controls={abierto ? idLista : undefined}
        aria-activedescendant={abierto && activa >= 0 ? idOpcion(activa) : undefined}
        disabled={disabled}
        onClick={() => (abierto ? cerrar() : abrir())}
        onKeyDown={alPulsarTecla}
        className={cn(
          'flex h-11 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 text-left text-base shadow-xs outline-none transition-[color,box-shadow] md:text-sm',
          'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
          'aria-invalid:border-destructive aria-invalid:ring-destructive/20',
          'aria-expanded:border-ring aria-expanded:ring-[3px] aria-expanded:ring-ring/50',
          'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      >
        <span className={cn('truncate', !elegida && 'text-muted-foreground')}>
          {elegida ? elegida.texto : placeholder}
        </span>
        <ChevronDown
          className={cn('size-4 shrink-0 opacity-50 transition-transform', abierto && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {abierto &&
        createPortal(
          <div
            ref={panel}
            id={idLista}
            role="listbox"
            aria-labelledby={id}
            className={cn(
              // `pointer-events-auto` (repetido en `style`): un diálogo modal deja el <body> sin
              // eventos de puntero y el panel cuelga de él.
              'superficie-flotante pointer-events-auto fixed z-50 flex max-h-72 flex-col overflow-y-auto overscroll-contain rounded-md border p-1 text-popover-foreground shadow-md',
              posicion ? 'visible' : 'invisible',
            )}
            style={{
              top: posicion?.top ?? 0,
              left: posicion?.left ?? 0,
              minWidth: posicion?.width,
              pointerEvents: 'auto',
            }}
            // Que pulsar una opción no le quite el foco al botón.
            onMouseDown={(evento) => evento.preventDefault()}
          >
            {opciones.map((opcion, indice) => {
              const seleccionada = indice === indiceElegido;
              return (
                <div
                  key={`${opcion.valor}-${indice}`}
                  id={idOpcion(indice)}
                  role="option"
                  aria-selected={seleccionada}
                  aria-disabled={opcion.deshabilitada || undefined}
                  data-activa={indice === activa || undefined}
                  className={cn(
                    'flex cursor-default select-none items-center gap-2 rounded-sm py-2 pl-2 pr-8 text-sm text-foreground outline-none relative',
                    'data-[activa]:bg-accent data-[activa]:text-accent-foreground',
                    'aria-disabled:pointer-events-none aria-disabled:opacity-50',
                  )}
                  onMouseMove={() => indice !== activa && setActiva(indice)}
                  onClick={() => {
                    elegir(indice);
                    cerrar({ devolverFoco: true });
                  }}
                >
                  <span className="truncate">{opcion.texto}</span>
                  {seleccionada && (
                    <Check className="absolute right-2 size-4" aria-hidden="true" />
                  )}
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}

export { Select };
