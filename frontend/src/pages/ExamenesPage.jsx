import { useCallback, useEffect, useState } from 'react';
import { FlaskConical, Pencil, Power, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import DialogoConfirmacion from '@/components/DialogoConfirmacion';
import ExamenFormDialog from '@/components/examenes/ExamenFormDialog';
import EncabezadoModulo from '@/components/layout/EncabezadoModulo';
import { Badge } from '@/components/ui/badge';
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
import { actualizarExamen, eliminarExamen, listarExamenes } from '@/services/catalogo.service';

/**
 * Catálogo de exámenes.
 *
 * Lo mantiene todo el personal: quien atiende al paciente es quien se encuentra
 * con el examen que falta o el nombre mal escrito. Un examen que ya está en
 * alguna cita u orden no se puede eliminar —se perdería ese historial—; se
 * desactiva para que deje de ofrecerse, y se puede volver a activar.
 */
function ExamenesPage() {
  const [termino, setTermino] = useState('');
  const terminoRetrasado = useTerminoRetrasado(termino);

  const [examenes, setExamenes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [dialogo, setDialogo] = useState({ abierto: false, examen: null });
  const [desactivando, setDesactivando] = useState(null);
  const [eliminando, setEliminando] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setExamenes(
        await listarExamenes({ termino: terminoRetrasado, incluirInactivos: true }),
      );
    } catch (error) {
      toast.error(error.message);
    } finally {
      setCargando(false);
    }
  }, [terminoRetrasado]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  /** El error sube al diálogo, que lo muestra sin cerrarse. */
  async function desactivar() {
    await actualizarExamen(desactivando.id, { activo: false });
    toast.success('Examen desactivado.');
    cargar();
  }

  async function activar(examen) {
    try {
      await actualizarExamen(examen.id, { activo: true });
      toast.success('Examen activado.');
      cargar();
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function eliminar() {
    await eliminarExamen(eliminando.id);
    toast.success('Examen eliminado.');
    cargar();
  }

  return (
    <div className="flex flex-col gap-8">
      <EncabezadoModulo
        icono={FlaskConical}
        titulo="Exámenes"
        descripcion="Catálogo de exámenes que se pueden asignar a una cita."
        acciones={
          <Button onClick={() => setDialogo({ abierto: true, examen: null })}>
            <FlaskConical aria-hidden="true" />
            Nuevo examen
          </Button>
        }
      />

      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="relative max-w-sm">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            className="pl-11"
            placeholder="Buscar por nombre o código"
            aria-label="Buscar exámenes"
            value={termino}
            onChange={(evento) => setTermino(evento.target.value)}
          />
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código IGSS</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead>Indicación al paciente</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {examenes.length === 0 ? (
            <TableEmpty colSpan={5}>
              {cargando
                ? 'Cargando...'
                : termino
                  ? 'Ningún examen coincide con la búsqueda.'
                  : 'Todavía no hay exámenes registrados.'}
            </TableEmpty>
          ) : (
            examenes.map((examen) => (
              <TableRow key={examen.id}>
                <TableCell className="whitespace-nowrap font-medium">
                  {examen.codigo}
                  {!examen.activo && (
                    <Badge variant="outline" className="ml-2">
                      Inactivo
                    </Badge>
                  )}
                </TableCell>
                <TableCell>{examen.nombre}</TableCell>
                <TableCell className="text-muted-foreground">{examen.descripcion}</TableCell>
                <TableCell className="max-w-[18rem] text-muted-foreground">
                  {examen.indicaciones}
                </TableCell>

                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Editar"
                      onClick={() => setDialogo({ abierto: true, examen })}
                    >
                      <Pencil aria-hidden="true" />
                      <span className="sr-only">Editar {examen.nombre}</span>
                    </Button>

                    {examen.activo ? (
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Desactivar"
                        onClick={() => setDesactivando(examen)}
                      >
                        <Power aria-hidden="true" />
                        <span className="sr-only">Desactivar {examen.nombre}</span>
                      </Button>
                    ) : (
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Activar"
                        className="text-primary"
                        onClick={() => activar(examen)}
                      >
                        <Power aria-hidden="true" />
                        <span className="sr-only">Activar {examen.nombre}</span>
                      </Button>
                    )}

                    <Button
                      size="icon"
                      variant="ghost"
                      title="Eliminar"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setEliminando(examen)}
                    >
                      <Trash2 aria-hidden="true" />
                      <span className="sr-only">Eliminar {examen.nombre}</span>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <ExamenFormDialog
        abierto={dialogo.abierto}
        examen={dialogo.examen}
        onCerrar={() => setDialogo({ abierto: false, examen: null })}
        onGuardado={cargar}
      />

      <DialogoConfirmacion
        abierto={Boolean(desactivando)}
        onCerrar={() => setDesactivando(null)}
        onConfirmar={desactivar}
        titulo={`¿Desactivar "${desactivando?.nombre}"?`}
        descripcion="Dejará de poder asignarse a citas nuevas. Las citas que ya lo tienen no cambian, y puede volver a activarlo cuando quiera."
        textoConfirmar="Desactivar"
      />

      <DialogoConfirmacion
        abierto={Boolean(eliminando)}
        onCerrar={() => setEliminando(null)}
        onConfirmar={eliminar}
        titulo={`¿Eliminar "${eliminando?.nombre}"?`}
        descripcion="Se borra del catálogo para siempre. Si ya está asignado a alguna cita u orden no se podrá eliminar: en ese caso desactívelo."
        textoConfirmar="Eliminar"
        destructivo
      />
    </div>
  );
}

export default ExamenesPage;
