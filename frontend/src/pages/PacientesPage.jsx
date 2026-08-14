import { useCallback, useEffect, useState } from 'react';
import { CalendarPlus, Eye, Pencil, Search, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';

import RecepcionCitaDialog from '@/components/citas/RecepcionCitaDialog';
import EncabezadoModulo from '@/components/layout/EncabezadoModulo';
import PacienteDetalleDialog from '@/components/pacientes/PacienteDetalleDialog';
import PacienteFormDialog from '@/components/pacientes/PacienteFormDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useTerminoRetrasado } from '@/hooks/useTerminoRetrasado';
import { buscarPacientes } from '@/services/paciente.service';
import { dpi as formatoDpi, telefono as formatoTelefono } from '@/lib/formato';

function PacientesPage() {
  const [termino, setTermino] = useState('');
  const terminoRetrasado = useTerminoRetrasado(termino);

  const [pacientes, setPacientes] = useState([]);
  const [paginacion, setPaginacion] = useState({ pagina: 1, totalPaginas: 1, total: 0 });
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(true);

  const [dialogo, setDialogo] = useState({ tipo: null, paciente: null });

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const datos = await buscarPacientes({ termino: terminoRetrasado, pagina });
      setPacientes(datos.pacientes);
      setPaginacion(datos.paginacion);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setCargando(false);
    }
  }, [terminoRetrasado, pagina]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    setPagina(1);
  }, [terminoRetrasado]);

  const abrir = (tipo, paciente = null) => setDialogo({ tipo, paciente });
  const cerrar = () => setDialogo({ tipo: null, paciente: null });

  return (
    <div className="flex flex-col gap-8">
      <EncabezadoModulo
        icono={Users}
        titulo="Pacientes"
        descripcion={
          <>
            <span className="cifra text-xl">{paginacion.total}</span> paciente(s) registrados.
          </>
        }
        acciones={
          <Button onClick={() => abrir('formulario')}>
            <UserPlus aria-hidden="true" />
            Registrar paciente
          </Button>
        }
      />

      {/* El buscador va en su propio panel: lo agrupa con los filtros y lo
          separa de la tabla que viene debajo. */}
      <div className="border-2 border-trazo bg-card p-4">
        <div className="relative max-w-sm">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            className="pl-11"
            placeholder="Buscar por nombre o teléfono"
            aria-label="Buscar pacientes"
            value={termino}
            onChange={(evento) => setTermino(evento.target.value)}
          />
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Teléfono</TableHead>
            <TableHead>DPI</TableHead>
            <TableHead>WhatsApp</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pacientes.length === 0 ? (
            <TableEmpty colSpan={5}>
              {cargando
                ? 'Cargando...'
                : termino
                  ? 'Ningún paciente coincide con la búsqueda.'
                  : 'Todavía no hay pacientes registrados.'}
            </TableEmpty>
          ) : (
            pacientes.map((paciente) => (
              <TableRow key={paciente.id}>
                <TableCell className="font-medium">{paciente.nombre_completo}</TableCell>
                <TableCell>{formatoTelefono(paciente.telefono)}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {paciente.dpi ? formatoDpi(paciente.dpi) : '—'}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {paciente.tiene_whatsapp === null
                    ? 'Sin comprobar'
                    : paciente.tiene_whatsapp
                      ? 'Sí'
                      : 'No'}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Ver ficha e historial"
                      onClick={() => abrir('detalle', paciente)}
                    >
                      <Eye aria-hidden="true" />
                      <span className="sr-only">Ver ficha de {paciente.nombre_completo}</span>
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Programar cita"
                      onClick={() => abrir('cita', paciente)}
                    >
                      <CalendarPlus aria-hidden="true" />
                      <span className="sr-only">Programar cita de {paciente.nombre_completo}</span>
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Editar"
                      onClick={() => abrir('formulario', paciente)}
                    >
                      <Pencil aria-hidden="true" />
                      <span className="sr-only">Editar a {paciente.nombre_completo}</span>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {paginacion.totalPaginas > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Página {paginacion.pagina} de {paginacion.totalPaginas}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={pagina <= 1}
              onClick={() => setPagina((actual) => actual - 1)}
            >
              Anterior
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pagina >= paginacion.totalPaginas}
              onClick={() => setPagina((actual) => actual + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}

      <PacienteFormDialog
        abierto={dialogo.tipo === 'formulario'}
        paciente={dialogo.paciente}
        onCerrar={cerrar}
        onGuardado={cargar}
      />

      <PacienteDetalleDialog
        abierto={dialogo.tipo === 'detalle'}
        paciente={dialogo.paciente}
        onCerrar={cerrar}
        onNuevaCita={(paciente) => abrir('cita', paciente)}
      />

      {/* La orden del IGSS ya no se registra por separado: nace con la cita. */}
      <RecepcionCitaDialog
        abierto={dialogo.tipo === 'cita'}
        pacienteInicial={dialogo.paciente}
        onCerrar={cerrar}
        onGuardada={cargar}
      />
    </div>
  );
}

export default PacientesPage;
