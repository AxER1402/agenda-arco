import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, CalendarPlus, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

import AccionesCita from '@/components/citas/AccionesCita';
import RecepcionCitaDialog from '@/components/citas/RecepcionCitaDialog';
import ReprogramarDialog from '@/components/citas/ReprogramarDialog';
import EncabezadoModulo, { TituloSeccion } from '@/components/layout/EncabezadoModulo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { obtenerAgenda } from '@/services/cita.service';
import {
  fechaConDiaSemana,
  fechaLarga,
  hora12,
  hoyISO,
  telefono as formatoTelefono,
  varianteEstado,
  varianteVencimiento,
} from '@/lib/formato';
import { cn } from '@/lib/utils';

const VISTAS = [
  { valor: 'dia', texto: 'Día' },
  { valor: 'semana', texto: 'Semana' },
  { valor: 'mes', texto: 'Mes' },
];

/** Desplaza la fecha de referencia según la vista activa. */
function desplazar(fechaISO, vista, direccion) {
  const fecha = new Date(`${fechaISO}T12:00:00Z`);

  if (vista === 'dia') fecha.setUTCDate(fecha.getUTCDate() + direccion);
  if (vista === 'semana') fecha.setUTCDate(fecha.getUTCDate() + 7 * direccion);
  if (vista === 'mes') fecha.setUTCMonth(fecha.getUTCMonth() + direccion);

  return fecha.toISOString().slice(0, 10);
}

function AgendaPage() {
  const [vista, setVista] = useState('dia');
  const [fecha, setFecha] = useState(hoyISO());
  const [agenda, setAgenda] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [reprogramando, setReprogramando] = useState(null);
  const [agendando, setAgendando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      // Las canceladas se muestran, con su estado a la vista. Ocultarlas hacía
      // que cancelar pareciera un borrado: la fila desaparecía del día.
      setAgenda(await obtenerAgenda({ vista, fecha, incluirCanceladas: true }));
    } catch (error) {
      toast.error(error.message);
    } finally {
      setCargando(false);
    }
  }, [vista, fecha]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const diasConCitas = (agenda?.dias ?? []).filter((dia) => dia.citas.length > 0);

  return (
    <div className="flex flex-col gap-8">
      <EncabezadoModulo
        icono={CalendarDays}
        titulo="Agenda"
        descripcion={
          agenda
            ? `${agenda.total_citas} cita(s) entre el ${fechaLarga(agenda.rango.desde)} y el ${fechaLarga(agenda.rango.hasta)}`
            : 'Cargando...'
        }
        acciones={
          <>
            <Button onClick={() => setAgendando(true)}>
              <CalendarPlus aria-hidden="true" />
              Nueva cita
            </Button>

            {/* Bloque segmentado: los trazos contiguos se solapan con -ml-0.5,
                así la división entre opciones mide lo mismo que el marco. */}
            <div className="flex" role="group" aria-label="Vista de la agenda">
              {VISTAS.map(({ valor, texto }) => (
                <Button
                  key={valor}
                  size="sm"
                  variant={vista === valor ? 'default' : 'outline'}
                  aria-pressed={vista === valor}
                  onClick={() => setVista(valor)}
                  className="-ml-0.5 first:ml-0"
                >
                  {texto}
                </Button>
              ))}
            </div>

            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="outline"
                aria-label="Periodo anterior"
                onClick={() => setFecha((actual) => desplazar(actual, vista, -1))}
              >
                <ChevronLeft aria-hidden="true" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => setFecha(hoyISO())}>
                Hoy
              </Button>
              <Button
                size="icon"
                variant="outline"
                aria-label="Periodo siguiente"
                onClick={() => setFecha((actual) => desplazar(actual, vista, 1))}
              >
                <ChevronRight aria-hidden="true" />
              </Button>
            </div>
          </>
        }
      />

      {/* Vista de mes: cuadrícula de ocupación. */}
      {vista === 'mes' && agenda && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Ocupación del mes</CardTitle>
            <CardDescription>
              Límite de {agenda.limite_diario} pacientes por día.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((dia) => (
                <div key={dia} className="pb-1 font-medium text-muted-foreground">
                  {dia}
                </div>
              ))}

              {/* Huecos hasta que empiece el primer día del mes. */}
              {Array.from({ length: (agenda.dias[0]?.dia_semana ?? 1) - 1 }).map((_, indice) => (
                <div key={`hueco-${indice}`} />
              ))}

              {agenda.dias.map((dia) => (
                <button
                  key={dia.fecha}
                  type="button"
                  onClick={() => {
                    setVista('dia');
                    setFecha(dia.fecha);
                  }}
                  className={cn(
                    'flex aspect-square flex-col items-center justify-center gap-0.5 rounded-md border p-1',
                    'transition-colors',
                    !dia.laborable && 'border-linea bg-secondary text-muted-foreground',
                    dia.laborable && 'bg-card',
                    dia.laborable &&
                      dia.disponibles === 0 &&
                      'border-destructive bg-destructive-suave text-destructive',
                    dia.laborable && dia.disponibles > 0 && 'hover:bg-accent',
                    dia.fecha === hoyISO() && 'ring-2 ring-primary ring-inset',
                  )}
                >
                  <span className="cifra text-base">{Number(dia.fecha.slice(8, 10))}</span>
                  {dia.laborable && (
                    <span className="text-[10px] tabular-nums opacity-70">
                      {dia.ocupacion}/{dia.limite}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Días con sus citas. */}
      {cargando && !agenda ? (
        <p className="text-muted-foreground">Cargando agenda...</p>
      ) : diasConCitas.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No hay citas programadas en este periodo.
          </CardContent>
        </Card>
      ) : (
        diasConCitas.map((dia) => (
          <section key={dia.fecha} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <TituloSeccion className="text-xl capitalize">
                {fechaConDiaSemana(dia.fecha)}
              </TituloSeccion>
              <Badge variant={dia.disponibles === 0 ? 'destructive' : 'secondary'}>
                {dia.ocupacion} de {dia.limite} — {dia.disponibles} disponibles
              </Badge>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hora</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Exámenes</TableHead>
                  <TableHead>Vence</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dia.citas.length === 0 ? (
                  <TableEmpty colSpan={7}>Sin citas.</TableEmpty>
                ) : (
                  dia.citas.map((cita) => (
                    <TableRow key={cita.id}>
                      <TableCell className="whitespace-nowrap font-medium">
                        {hora12(String(cita.hora))}
                      </TableCell>
                      <TableCell>{cita.paciente_nombre}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatoTelefono(cita.paciente_telefono)}
                      </TableCell>
                      <TableCell className="max-w-[16rem] truncate">
                        {cita.examenes.map((examen) => examen.nombre).join(', ')}
                      </TableCell>
                      <TableCell>
                        <Badge variant={varianteVencimiento(cita.dias_para_vencer)}>
                          {cita.vencimiento_texto}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={varianteEstado(cita.estado)}>{cita.estado_nombre}</Badge>
                      </TableCell>
                      <TableCell>
                        <AccionesCita
                          cita={cita}
                          onCambiada={cargar}
                          onReprogramar={setReprogramando}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </section>
        ))
      )}

      <RecepcionCitaDialog
        abierto={agendando}
        onCerrar={() => setAgendando(false)}
        onGuardada={cargar}
      />

      <ReprogramarDialog
        abierto={Boolean(reprogramando)}
        cita={reprogramando}
        onCerrar={() => setReprogramando(null)}
        onGuardada={cargar}
      />
    </div>
  );
}

export default AgendaPage;
