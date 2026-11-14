import { useCallback, useEffect, useState } from 'react';
import { CalendarPlus } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { historialDePaciente } from '@/services/paciente.service';
import { listarOrdenesDePaciente } from '@/services/catalogo.service';
import {
  dpi as formatoDpi,
  fechaLarga,
  hora12,
  telefono as formatoTelefono,
  varianteEstado,
  varianteVencimiento,
} from '@/lib/formato';

/**
 * Ficha del paciente: sus órdenes del IGSS y su historial de citas
 * (requisito 12).
 */
function PacienteDetalleDialog({ abierto, onCerrar, paciente, onNuevaCita }) {
  const [ordenes, setOrdenes] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async () => {
    if (!paciente) return;

    setCargando(true);
    try {
      const [susOrdenes, susCitas] = await Promise.all([
        listarOrdenesDePaciente(paciente.id),
        historialDePaciente(paciente.id),
      ]);
      setOrdenes(susOrdenes);
      setHistorial(susCitas);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setCargando(false);
    }
  }, [paciente]);

  useEffect(() => {
    if (abierto) cargar();
  }, [abierto, cargar]);

  return (
    <Dialog open={abierto} onOpenChange={(valor) => !valor && onCerrar()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{paciente?.nombre_completo}</DialogTitle>
          <DialogDescription>
            Teléfono: {formatoTelefono(paciente?.telefono)}
            {paciente?.dpi && ` — DPI ${formatoDpi(paciente.dpi)}`}
            {paciente?.tiene_whatsapp === 0 && ' — sin WhatsApp'}
          </DialogDescription>
        </DialogHeader>

        {/* Programar cita solo aparece donde hay un flujo que la reciba: desde
            el menú de acciones de una cita la ficha es solo de consulta. */}
        {onNuevaCita && (
          <div className="flex flex-wrap gap-2">
            {/* La orden del IGSS se registra dentro de la propia cita. */}
            <Button size="sm" onClick={() => onNuevaCita(paciente)}>
              <CalendarPlus aria-hidden="true" />
              Programar cita
            </Button>
          </div>
        )}

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Órdenes del IGSS</h3>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entrega</TableHead>
                <TableHead>Vencimiento</TableHead>
                <TableHead>Exámenes</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ordenes.length === 0 ? (
                <TableEmpty colSpan={4}>
                  {cargando ? 'Cargando...' : 'Sin órdenes registradas.'}
                </TableEmpty>
              ) : (
                ordenes.map((orden) => (
                  <TableRow key={orden.id}>
                    <TableCell>{fechaLarga(orden.fecha_entrega)}</TableCell>
                    <TableCell>{fechaLarga(orden.fecha_vencimiento)}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {orden.examenes.map((examen) => examen.nombre).join(', ')}
                    </TableCell>
                    <TableCell>
                      <Badge variant={varianteVencimiento(orden.dias_para_vencer)}>
                        {orden.dias_para_vencer < 0
                          ? 'Vencida'
                          : `Vence en ${orden.dias_para_vencer} día(s)`}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Historial de citas</h3>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Hora</TableHead>
                <TableHead>Exámenes</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historial.length === 0 ? (
                <TableEmpty colSpan={4}>
                  {cargando ? 'Cargando...' : 'Este paciente todavía no tiene citas.'}
                </TableEmpty>
              ) : (
                historial.map((cita) => (
                  <TableRow key={cita.id}>
                    <TableCell>{fechaLarga(cita.fecha)}</TableCell>
                    <TableCell>{hora12(String(cita.hora))}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {cita.examenes.map((examen) => examen.nombre).join(', ')}
                    </TableCell>
                    <TableCell>
                      <Badge variant={varianteEstado(cita.estado)}>{cita.estado_nombre}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </section>
      </DialogContent>
    </Dialog>
  );
}

export default PacienteDetalleDialog;
