import { useCallback, useEffect, useState } from 'react';
import { CalendarOff, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import CampoFormulario from '@/components/CampoFormulario';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SelectorFecha } from '@/components/ui/selector-fecha';
import { actualizarConfiguracion, obtenerConfiguracion } from '@/services/catalogo.service';
import { feriadoEn } from '@/lib/calendario';
import { fechaLarga, hoyISO } from '@/lib/formato';

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const VACIO = { fecha: '', descripcion: '', anual: false };

/** '2026-09-15' → '15 de septiembre' */
function diaYMes(iso) {
  return `${Number(iso.slice(8, 10))} de ${MESES[Number(iso.slice(5, 7)) - 1]}`;
}

/**
 * Días feriados: fechas en que el laboratorio cierra aunque el día de la
 * semana sea de atención.
 *
 * Cada alta o baja se guarda en el acto —no hay un «Guardar» aparte que
 * olvidar—, y desde ese momento la agenda no admite citas ese día y los
 * calendarios lo muestran apagado. Los marcados «cada año» (Navidad, 15 de
 * septiembre) se registran una sola vez; los que cambian de fecha, como Semana
 * Santa, se agregan sueltos para cada año.
 */
function FeriadosCard() {
  const [feriados, setFeriados] = useState([]);
  const [nuevo, setNuevo] = useState(VACIO);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const configuracion = await obtenerConfiguracion();
      setFeriados(configuracion.dias_feriados ?? []);
    } catch (problema) {
      toast.error(problema.message);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function guardar(lista, mensaje) {
    setGuardando(true);
    try {
      const configuracion = await actualizarConfiguracion({ dias_feriados: lista });
      setFeriados(configuracion.dias_feriados ?? lista);
      toast.success(mensaje);
      return true;
    } catch (problema) {
      toast.error(problema.message);
      return false;
    } finally {
      setGuardando(false);
    }
  }

  async function agregar(evento) {
    evento.preventDefault();

    if (!nuevo.fecha) {
      setError('Elija la fecha del feriado.');
      return;
    }

    // Se avisa aquí para no mandar al backend algo que va a rechazar.
    const existente = nuevo.anual
      ? feriados.find((feriado) => feriado.fecha.slice(5) === nuevo.fecha.slice(5))
      : feriadoEn(nuevo.fecha, feriados);
    if (existente) {
      setError(
        `Ese día ya está registrado${existente.descripcion ? ` (${existente.descripcion})` : ''}.`,
      );
      return;
    }

    const guardado = await guardar(
      [...feriados, { ...nuevo, descripcion: nuevo.descripcion.trim() }],
      'Feriado agregado. Ese día ya no admite citas.',
    );
    if (guardado) setNuevo(VACIO);
  }

  function quitar(aQuitar) {
    guardar(
      feriados.filter((feriado) => feriado !== aQuitar),
      'Feriado quitado. Ese día vuelve a admitir citas.',
    );
  }

  const anuales = feriados
    .filter((feriado) => feriado.anual)
    .sort((uno, otro) => uno.fecha.slice(5).localeCompare(otro.fecha.slice(5)));
  const sueltos = feriados
    .filter((feriado) => !feriado.anual)
    .sort((uno, otro) => uno.fecha.localeCompare(otro.fecha));
  const hoy = hoyISO();

  function fila(feriado, fecha, pasado = false) {
    return (
      <li
        key={`${feriado.fecha}-${feriado.anual}`}
        className="flex items-center justify-between gap-2 border-b border-linea py-2 last:border-b-0"
      >
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <span className="whitespace-nowrap text-sm font-medium tabular-nums">{fecha}</span>
          <span className="text-sm text-muted-foreground">
            {feriado.descripcion || 'Sin descripción'}
          </span>
          {pasado && <Badge variant="outline">Ya pasó</Badge>}
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label={`Quitar el feriado del ${fecha}`}
          title="Quitar"
          disabled={guardando}
          onClick={() => quitar(feriado)}
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </li>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Días feriados</CardTitle>
        <CardDescription>
          En estos días no se agenda: los calendarios los muestran apagados y la agenda no admite
          citas. Las citas que ya estuvieran puestas ese día no se mueven solas.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        <form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[14rem_1fr_auto_auto]" onSubmit={agregar}>
          <CampoFormulario id="feriado-fecha" etiqueta="Fecha" error={error}>
            {(props) => (
              <SelectorFecha
                {...props}
                value={nuevo.fecha}
                onChange={(evento) => {
                  setNuevo((previo) => ({ ...previo, fecha: evento.target.value }));
                  setError(null);
                }}
              />
            )}
          </CampoFormulario>

          <CampoFormulario id="feriado-descripcion" etiqueta="Descripción">
            {(props) => (
              <Input
                {...props}
                maxLength={80}
                placeholder="Día de la Independencia"
                value={nuevo.descripcion}
                onChange={(evento) =>
                  setNuevo((previo) => ({ ...previo, descripcion: evento.target.value }))
                }
              />
            )}
          </CampoFormulario>

          <label className="flex cursor-pointer items-center gap-2 self-end pb-3 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-titular"
              checked={nuevo.anual}
              onChange={(evento) => {
                setNuevo((previo) => ({ ...previo, anual: evento.target.checked }));
                setError(null);
              }}
            />
            Se repite cada año
          </label>

          <div className="flex items-end">
            <Button type="submit" disabled={guardando}>
              <Plus aria-hidden="true" />
              Agregar feriado
            </Button>
          </div>
        </form>

        {feriados.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarOff className="size-4" aria-hidden="true" />
            Todavía no hay feriados registrados.
          </p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {anuales.length > 0 && (
              <section className="flex flex-col gap-1">
                <h3 className="rotulo">Cada año</h3>
                <ul aria-label="Feriados de cada año">
                  {anuales.map((feriado) => fila(feriado, diaYMes(feriado.fecha)))}
                </ul>
              </section>
            )}

            {sueltos.length > 0 && (
              <section className="flex flex-col gap-1">
                <h3 className="rotulo">Fechas concretas</h3>
                <ul aria-label="Feriados de fecha concreta">
                  {sueltos.map((feriado) =>
                    fila(feriado, fechaLarga(feriado.fecha), feriado.fecha < hoy),
                  )}
                </ul>
              </section>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default FeriadosCard;
