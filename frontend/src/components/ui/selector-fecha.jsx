import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import { fechaLarga } from '@/lib/formato';

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** En Guatemala la semana del calendario empieza en domingo. */
const DIAS_SEMANA = [
  { corto: 'Do', largo: 'domingo' },
  { corto: 'Lu', largo: 'lunes' },
  { corto: 'Ma', largo: 'martes' },
  { corto: 'Mi', largo: 'miércoles' },
  { corto: 'Ju', largo: 'jueves' },
  { corto: 'Vi', largo: 'viernes' },
  { corto: 'Sá', largo: 'sábado' },
];

// --- Aritmética de fechas sobre 'AAAA-MM-DD' -------------------------------
// Todo en UTC: así la zona horaria del equipo nunca desplaza el día.

function aFecha(iso) {
  return new Date(`${iso}T00:00:00Z`);
}

function aISO(fecha) {
  return fecha.toISOString().slice(0, 10);
}

function esISO(valor) {
  return typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor);
}

function sumarDias(iso, dias) {
  const fecha = aFecha(iso);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return aISO(fecha);
}

/** Mismo día del mes desplazado; si no existe (31 de febrero), el último. */
function sumarMeses(iso, meses) {
  const fecha = aFecha(iso);
  const dia = fecha.getUTCDate();
  fecha.setUTCDate(1);
  fecha.setUTCMonth(fecha.getUTCMonth() + meses);
  const ultimo = new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth() + 1, 0)).getUTCDate();
  fecha.setUTCDate(Math.min(dia, ultimo));
  return aISO(fecha);
}

function hoyLocal() {
  const ahora = new Date();
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia = String(ahora.getDate()).padStart(2, '0');
  return `${ahora.getFullYear()}-${mes}-${dia}`;
}

/** Las 42 casillas (6 semanas) que pintan el mes de `iso`. */
function casillasDelMes(iso) {
  const primero = `${iso.slice(0, 7)}-01`;
  const inicio = sumarDias(primero, -aFecha(primero).getUTCDay());
  return Array.from({ length: 42 }, (_, i) => sumarDias(inicio, i));
}

function nombreDia(iso) {
  const fecha = aFecha(iso);
  return `${DIAS_SEMANA[fecha.getUTCDay()].largo} ${fecha.getUTCDate()} de ${MESES[fecha.getUTCMonth()]} de ${fecha.getUTCFullYear()}`;
}

/**
 * Selector de fecha con el aspecto del sistema.
 *
 * Sustituye al `<input type="date">`, cuyo calendario lo dibuja el navegador:
 * en cada equipo salía distinto, en inglés en algunos y sin nada del sistema.
 * Este abre su propio calendario sobre la misma superficie flotante que el
 * `Select`.
 *
 * Se usa igual que el nativo: `value` y `min`/`max` en 'AAAA-MM-DD', y
 * `onChange` recibe `{ target: { value } }`.
 *
 * Teclado: con el calendario cerrado, las flechas arriba/abajo mueven la fecha
 * un día y Enter lo abre. Abierto, las flechas recorren los días, RePág/AvPág
 * cambian de mes, Inicio/Fin van al principio o final de la semana, Enter
 * elige y Escape cierra.
 */
function SelectorFecha({
  id,
  value,
  onChange,
  min,
  max,
  disabled = false,
  placeholder = 'Seleccione una fecha',
  className,
  ...props
}) {
  const valor = esISO(value) ? value : '';
  const minimo = esISO(min) ? min : null;
  const maximo = esISO(max) ? max : null;

  const [abierto, setAbierto] = useState(false);
  /** El día con el foco dentro del calendario; también decide el mes visible. */
  const [enfocado, setEnfocado] = useState(valor || hoyLocal());
  const [posicion, setPosicion] = useState(null);

  const disparador = useRef(null);
  const panel = useRef(null);

  const hoy = hoyLocal();

  function permitido(iso) {
    return (!minimo || iso >= minimo) && (!maximo || iso <= maximo);
  }

  /** Lleva una fecha al rango permitido. */
  function acotar(iso) {
    if (minimo && iso < minimo) return minimo;
    if (maximo && iso > maximo) return maximo;
    return iso;
  }

  function elegir(iso) {
    if (!permitido(iso)) return;
    if (iso !== valor) onChange?.({ target: { value: iso } });
  }

  function abrir() {
    setEnfocado(acotar(valor || hoy));
    setAbierto(true);
  }

  function cerrar({ devolverFoco = false } = {}) {
    setAbierto(false);
    setPosicion(null);
    if (devolverFoco) disparador.current?.focus();
  }

  function alPulsarTeclaDisparador(evento) {
    const { key } = evento;

    if (key === 'ArrowDown' || key === 'ArrowUp') {
      evento.preventDefault();
      if (evento.altKey) return abrir();
      const base = valor || acotar(hoy);
      elegir(acotar(valor ? sumarDias(base, key === 'ArrowDown' ? 1 : -1) : base));
    } else if (key === 'Enter' || key === ' ') {
      evento.preventDefault();
      abrir();
    }
    return undefined;
  }

  function alPulsarTeclaCalendario(evento) {
    const desplazamientos = {
      ArrowLeft: () => sumarDias(enfocado, -1),
      ArrowRight: () => sumarDias(enfocado, 1),
      ArrowUp: () => sumarDias(enfocado, -7),
      ArrowDown: () => sumarDias(enfocado, 7),
      PageUp: () => sumarMeses(enfocado, evento.shiftKey ? -12 : -1),
      PageDown: () => sumarMeses(enfocado, evento.shiftKey ? 12 : 1),
      Home: () => sumarDias(enfocado, -aFecha(enfocado).getUTCDay()),
      End: () => sumarDias(enfocado, 6 - aFecha(enfocado).getUTCDay()),
    };

    if (desplazamientos[evento.key]) {
      evento.preventDefault();
      setEnfocado(acotar(desplazamientos[evento.key]()));
    } else if (evento.key === 'Enter' || evento.key === ' ') {
      evento.preventDefault();
      if (permitido(enfocado)) {
        elegir(enfocado);
        cerrar({ devolverFoco: true });
      }
    } else if (evento.key === 'Escape') {
      // Sin esto, el Escape llega también al diálogo y lo cierra entero.
      evento.preventDefault();
      evento.stopPropagation();
      cerrar({ devolverFoco: true });
    } else if (evento.key === 'Tab' && !panel.current?.contains(evento.target)) {
      cerrar();
    }
  }

  // La posición se mide después de pintar, cuando el panel ya tiene tamaño.
  useLayoutEffect(() => {
    if (!abierto || !disparador.current) return;

    const marco = disparador.current.getBoundingClientRect();
    const alto = panel.current?.offsetHeight ?? 0;
    const ancho = panel.current?.offsetWidth ?? 0;

    // Si no cabe debajo, se abre hacia arriba; si no cabe a la derecha, se
    // alinea con el borde derecho del campo.
    const cabeDebajo = marco.bottom + alto + 8 <= window.innerHeight;
    const cabeDerecha = marco.left + ancho + 8 <= window.innerWidth;

    setPosicion({
      top: cabeDebajo ? marco.bottom + 4 : Math.max(marco.top - alto - 4, 8),
      left: cabeDerecha ? marco.left : Math.max(marco.right - ancho, 8),
    });
  }, [abierto]);

  // El foco sigue al día enfocado: al abrir, y en cada paso con las flechas.
  useEffect(() => {
    if (!abierto || !posicion) return;
    panel.current?.querySelector(`[data-fecha="${enfocado}"]`)?.focus();
  }, [abierto, posicion, enfocado]);

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

    // El scroll de la página o del diálogo dejaría el panel flotando lejos.
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

  const mesVisible = enfocado.slice(0, 7);
  const fechaMes = aFecha(`${mesVisible}-01`);
  const tituloMes = `${MESES[fechaMes.getUTCMonth()]} ${fechaMes.getUTCFullYear()}`;
  const casillas = casillasDelMes(enfocado);

  const anteriorPermitido = !minimo || sumarDias(`${mesVisible}-01`, -1) >= minimo;
  const siguientePermitido = !maximo || `${sumarMeses(`${mesVisible}-01`, 1)}` <= maximo;

  return (
    <>
      <button
        ref={disparador}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={abierto}
        value={valor}
        data-min={minimo ?? undefined}
        data-max={maximo ?? undefined}
        disabled={disabled}
        onClick={() => (abierto ? cerrar() : abrir())}
        onKeyDown={alPulsarTeclaDisparador}
        className={cn(
          'flex h-11 w-full items-center gap-2 rounded-md border border-input bg-transparent px-3 text-left text-base shadow-xs outline-none transition-[color,box-shadow] md:text-sm',
          'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
          'aria-invalid:border-destructive aria-invalid:ring-destructive/20',
          'aria-expanded:border-ring aria-expanded:ring-[3px] aria-expanded:ring-ring/50',
          'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      >
        <CalendarDays className="size-4 shrink-0 opacity-50" aria-hidden="true" />
        <span className={cn('truncate tabular-nums', !valor && 'text-muted-foreground')}>
          {valor ? fechaLarga(valor) : placeholder}
        </span>
      </button>

      {abierto &&
        createPortal(
          <div
            ref={panel}
            role="dialog"
            aria-modal="false"
            aria-label="Elegir fecha"
            className={cn(
              // `pointer-events-auto` (repetido en `style`): un diálogo modal deja el <body> sin
              // eventos de puntero y el panel cuelga de él.
              'superficie-flotante pointer-events-auto fixed z-50 w-72 rounded-md border p-3 text-popover-foreground shadow-md',
              posicion ? 'visible' : 'invisible',
            )}
            style={{ top: posicion?.top ?? 0, left: posicion?.left ?? 0, pointerEvents: 'auto' }}
            onKeyDown={alPulsarTeclaCalendario}
          >
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-30"
                onClick={() => setEnfocado(acotar(sumarMeses(enfocado, -1)))}
                disabled={!anteriorPermitido}
                tabIndex={-1}
                aria-label="Mes anterior"
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
              </button>

              <p className="text-sm font-semibold capitalize text-titular" aria-live="polite">
                {tituloMes}
              </p>

              <button
                type="button"
                className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-30"
                onClick={() => setEnfocado(acotar(sumarMeses(enfocado, 1)))}
                disabled={!siguientePermitido}
                tabIndex={-1}
                aria-label="Mes siguiente"
              >
                <ChevronRight className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div role="grid" aria-label={tituloMes} className="grid grid-cols-7 gap-y-1">
              <div role="row" className="contents">
                {DIAS_SEMANA.map((dia) => (
                  <span
                    key={dia.corto}
                    role="columnheader"
                    aria-label={dia.largo}
                    className="pb-1 text-center text-xs font-medium text-muted-foreground"
                  >
                    {dia.corto}
                  </span>
                ))}
              </div>

              {Array.from({ length: 6 }, (_, semana) => (
                <div role="row" key={semana} className="contents">
                  {casillas.slice(semana * 7, semana * 7 + 7).map((iso) => {
                    const delMes = iso.startsWith(mesVisible);
                    const elegida = iso === valor;
                    const habilitada = permitido(iso);

                    return (
                      <span role="gridcell" key={iso} aria-selected={elegida} className="flex justify-center">
                        <button
                          type="button"
                          data-fecha={iso}
                          tabIndex={iso === enfocado ? 0 : -1}
                          disabled={!habilitada}
                          aria-label={nombreDia(iso)}
                          aria-current={iso === hoy ? 'date' : undefined}
                          onClick={() => {
                            elegir(iso);
                            cerrar({ devolverFoco: true });
                          }}
                          className={cn(
                            'inline-flex size-9 items-center justify-center rounded-md text-sm tabular-nums outline-none transition-colors',
                            'hover:bg-accent hover:text-accent-foreground',
                            'focus-visible:ring-[3px] focus-visible:ring-ring/50',
                            !delMes && 'text-muted-foreground/60',
                            iso === hoy && !elegida && 'font-semibold text-primary ring-1 ring-inset ring-primary/40',
                            elegida && 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
                            'disabled:pointer-events-none disabled:text-muted-foreground/30 disabled:line-through',
                          )}
                        >
                          {aFecha(iso).getUTCDate()}
                        </button>
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>

            {permitido(hoy) && (
              <div className="mt-2 flex justify-end border-t pt-2">
                <button
                  type="button"
                  className="rounded-md px-2 py-1 text-sm font-medium text-primary hover:bg-accent"
                  onClick={() => {
                    elegir(hoy);
                    cerrar({ devolverFoco: true });
                  }}
                >
                  Hoy
                </button>
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

export { SelectorFecha };
