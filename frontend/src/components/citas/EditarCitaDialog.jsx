import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

import CampoFormulario from '@/components/CampoFormulario';
import ExamenFormDialog from '@/components/examenes/ExamenFormDialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { listarExamenes } from '@/services/catalogo.service';
import { actualizarCita, obtenerCita } from '@/services/cita.service';
import { fechaLarga, hora12 } from '@/lib/formato';

/**
 * Edición de los exámenes y las notas de una cita ya agendada.
 *
 * La fecha y la hora no se tocan aquí: moverlas revalida vigencia y cupo, y eso
 * vive en «Reprogramar». Esto es para corregir lo que se anotó al recibir al
 * paciente —el examen que se olvidó marcar, una nota—.
 *
 * Se pueden marcar exámenes que la orden no tenía; el backend los agrega
 * también a la orden.
 */
function EditarCitaDialog({ abierto, onCerrar, cita, onGuardada }) {
  const [catalogo, setCatalogo] = useState([]);
  const [seleccionados, setSeleccionados] = useState([]);
  const [notas, setNotas] = useState('');
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [nuevoExamen, setNuevoExamen] = useState(false);

  useEffect(() => {
    if (!abierto || !cita) return undefined;

    let vigente = true;
    setCargando(true);
    setError(null);

    // La cita se pide entera: la fila de una tabla puede no traer las notas.
    Promise.all([obtenerCita(cita.id), listarExamenes()])
      .then(([completa, examenes]) => {
        if (!vigente) return;

        const propios = completa.examenes ?? [];
        // Los de la cita se muestran aunque luego se hayan desactivado.
        const faltantes = propios.filter((examen) => !examenes.some((e) => e.id === examen.id));

        setCatalogo([...examenes, ...faltantes]);
        setSeleccionados(propios.map((examen) => examen.id));
        setNotas(completa.notas ?? '');
      })
      .catch((causa) => vigente && toast.error(causa.message))
      .finally(() => vigente && setCargando(false));

    return () => {
      vigente = false;
    };
  }, [abierto, cita]);

  function alternar(id) {
    setSeleccionados((previos) =>
      previos.includes(id) ? previos.filter((otro) => otro !== id) : [...previos, id],
    );
    setError(null);
  }

  function agregarExamenNuevo(examen) {
    setCatalogo((previos) => [...previos, examen]);
    setSeleccionados((previos) => [...previos, examen.id]);
  }

  async function enviar(evento) {
    evento.preventDefault();

    if (seleccionados.length === 0) {
      setError('Indique al menos un examen.');
      return;
    }

    setGuardando(true);

    try {
      await actualizarCita(cita.id, { examenes: seleccionados, notas });
      toast.success('Cita actualizada.');
      onGuardada?.();
      onCerrar();
    } catch (causa) {
      toast.error(causa.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <Dialog open={abierto} onOpenChange={(valor) => !valor && onCerrar()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar cita</DialogTitle>
            <DialogDescription>
              {cita?.paciente_nombre} — {fechaLarga(cita?.fecha)} a las{' '}
              {hora12(String(cita?.hora ?? ''))}
            </DialogDescription>
          </DialogHeader>

          <form className="flex flex-col gap-4" onSubmit={enviar} noValidate>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">
                  Exámenes<span className="ml-0.5 text-destructive">*</span>
                </span>
                <Button type="button" size="sm" variant="outline" onClick={() => setNuevoExamen(true)}>
                  <Plus aria-hidden="true" />
                  No está en la lista
                </Button>
              </div>

              <div className="grid max-h-56 gap-1 overflow-y-auto rounded-lg border p-2 sm:grid-cols-2">
                {cargando ? (
                  <p className="p-2 text-sm text-muted-foreground">Cargando...</p>
                ) : (
                  catalogo.map((examen) => (
                    <label
                      key={examen.id}
                      className="flex cursor-pointer items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent"
                    >
                      <input
                        type="checkbox"
                        className="size-4 accent-[var(--primary)]"
                        checked={seleccionados.includes(examen.id)}
                        onChange={() => alternar(examen.id)}
                      />
                      <span className="rotulo shrink-0">{examen.codigo}</span>
                      {examen.nombre}
                    </label>
                  ))
                )}
              </div>

              {error && <p className="text-xs font-medium text-destructive">{error}</p>}
            </div>

            <CampoFormulario id="editar-cita-notas" etiqueta="Notas">
              {(props) => (
                <Textarea
                  {...props}
                  rows={3}
                  maxLength={255}
                  value={notas}
                  onChange={(evento) => setNotas(evento.target.value)}
                />
              )}
            </CampoFormulario>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onCerrar}>
                Cancelar
              </Button>
              <Button type="submit" disabled={guardando || cargando}>
                {guardando ? 'Guardando...' : 'Guardar cambios'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ExamenFormDialog
        abierto={nuevoExamen}
        onCerrar={() => setNuevoExamen(false)}
        onGuardado={agregarExamenNuevo}
      />
    </>
  );
}

export default EditarCitaDialog;
