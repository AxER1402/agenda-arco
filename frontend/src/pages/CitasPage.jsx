import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarPlus, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';

import AccionesCita from '@/components/citas/AccionesCita';
import EstadoRecordatorio from '@/components/citas/EstadoRecordatorio';
import RecepcionCitaDialog from '@/components/citas/RecepcionCitaDialog';
import ReprogramarDialog from '@/components/citas/ReprogramarDialog';
import EncabezadoModulo from '@/components/layout/EncabezadoModulo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SelectNativo } from '@/components/ui/select-nativo';
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { listarEstadosCita, obtenerAgenda } from '@/services/cita.service';
import {
  fechaLarga,
  hora12,
  hoyISO,
  telefono as formatoTelefono,
  varianteEstado,
} from '@/lib/formato';

/**
 * Listado de citas con filtros.
 * Complementa a la agenda: aquí se busca por estado ("¿quién falta por
 * confirmar?", "¿quién no asistió?") en lugar de por día.
 */
function CitasPage() {
  const [periodo, setPeriodo] = useState({ vista: 'semana', fecha: hoyISO() });
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [estados, setEstados] = useState([]);
  const [agenda, setAgenda] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [reprogramando, setReprogramando] = useState(null);
  const [agendando, setAgendando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setAgenda(
        await obtenerAgenda({ ...periodo, incluirCanceladas: true }),
      );
    } catch (error) {
      toast.error(error.message);
    } finally {
      setCargando(false);
    }
  }, [periodo]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    listarEstadosCita().then(setEstados).catch(() => setEstados([]));
  }, []);

  const citas = useMemo(() => {
    const todas = (agenda?.dias ?? []).flatMap((dia) => dia.citas);
    return estadoFiltro ? todas.filter((cita) => cita.estado === estadoFiltro) : todas;
  }, [agenda, estadoFiltro]);

  return (
    <div className="flex flex-col gap-8">
      <EncabezadoModulo
        icono={ClipboardList}
        titulo="Citas"
        descripcion={`${citas.length} cita(s) en el periodo seleccionado. Para programar una, basta el teléfono del paciente.`}
        acciones={
          <Button onClick={() => setAgendando(true)}>
            <CalendarPlus aria-hidden="true" />
            Programar cita
          </Button>
        }
      />

      {/* Los filtros van en su propio panel: quedan agrupados y separados de la
          tabla de resultados. */}
      <div className="flex flex-wrap items-end gap-4 rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-2">
          <Label htmlFor="periodo-fecha">Fecha de referencia</Label>
          <Input
            id="periodo-fecha"
            type="date"
            value={periodo.fecha}
            onChange={(evento) =>
              setPeriodo((previo) => ({ ...previo, fecha: evento.target.value }))
            }
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="periodo-vista">Periodo</Label>
          <SelectNativo
            id="periodo-vista"
            value={periodo.vista}
            onChange={(evento) =>
              setPeriodo((previo) => ({ ...previo, vista: evento.target.value }))
            }
          >
            <option value="dia">Ese día</option>
            <option value="semana">Esa semana</option>
            <option value="mes">Ese mes</option>
          </SelectNativo>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="filtro-estado">Estado</Label>
          <SelectNativo
            id="filtro-estado"
            value={estadoFiltro}
            onChange={(evento) => setEstadoFiltro(evento.target.value)}
          >
            <option value="">Todos</option>
            {estados.map((estado) => (
              <option key={estado.id} value={estado.codigo}>
                {estado.nombre}
              </option>
            ))}
          </SelectNativo>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Hora</TableHead>
            <TableHead>Paciente</TableHead>
            <TableHead>Teléfono</TableHead>
            <TableHead>Vence</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>WhatsApp</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {citas.length === 0 ? (
            <TableEmpty colSpan={8}>
              {cargando ? 'Cargando...' : 'No hay citas que coincidan con los filtros.'}
            </TableEmpty>
          ) : (
            citas.map((cita) => (
              <TableRow key={cita.id}>
                <TableCell className="whitespace-nowrap">{fechaLarga(cita.fecha)}</TableCell>
                <TableCell className="whitespace-nowrap">{hora12(String(cita.hora))}</TableCell>
                <TableCell className="font-medium">{cita.paciente_nombre}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {formatoTelefono(cita.paciente_telefono)}
                </TableCell>
                <TableCell className="whitespace-nowrap">{cita.vencimiento_texto}</TableCell>
                <TableCell>
                  <Badge variant={varianteEstado(cita.estado)}>{cita.estado_nombre}</Badge>
                </TableCell>
                <TableCell>
                  <EstadoRecordatorio cita={cita} />
                </TableCell>
                <TableCell>
                  <AccionesCita cita={cita} onCambiada={cargar} onReprogramar={setReprogramando} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

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

export default CitasPage;
