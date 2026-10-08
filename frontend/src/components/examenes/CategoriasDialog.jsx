import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import CampoFormulario from '@/components/CampoFormulario';
import DialogoConfirmacion from '@/components/DialogoConfirmacion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  actualizarCategoria,
  crearCategoria,
  eliminarCategoria,
  listarCategorias,
} from '@/services/catalogo.service';

const VACIO = { nombre: '', indicaciones: '' };

/**
 * Categorías de exámenes: Sangre, Orina, Heces...
 *
 * La indicación de la categoría (el ayuno de 12 horas, por ejemplo) se escribe
 * una sola vez aquí y le llega a cualquier paciente que tenga al menos un
 * examen de la categoría, una sola vez aunque traiga varios. Qué examen va en
 * cada categoría se elige al editar el examen.
 *
 * @param {() => void} [onCambiadas] Para que la página recargue los exámenes,
 *   que muestran el nombre de su categoría.
 */
function CategoriasDialog({ abierto, onCerrar, onCambiadas }) {
  const [categorias, setCategorias] = useState([]);
  const [valores, setValores] = useState(VACIO);
  /** La categoría que se está editando; null mientras se crea una nueva. */
  const [editando, setEditando] = useState(null);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState(null);

  const cargar = useCallback(async () => {
    try {
      setCategorias(await listarCategorias());
    } catch (problema) {
      toast.error(problema.message);
    }
  }, []);

  useEffect(() => {
    if (!abierto) return;
    setValores(VACIO);
    setEditando(null);
    setError(null);
    cargar();
  }, [abierto, cargar]);

  function empezarEdicion(categoria) {
    setEditando(categoria);
    setValores({ nombre: categoria.nombre, indicaciones: categoria.indicaciones ?? '' });
    setError(null);
  }

  function cancelarEdicion() {
    setEditando(null);
    setValores(VACIO);
    setError(null);
  }

  async function guardar(evento) {
    evento.preventDefault();

    if (!valores.nombre.trim()) {
      setError('Escriba el nombre de la categoría.');
      return;
    }

    setGuardando(true);
    try {
      if (editando) {
        await actualizarCategoria(editando.id, valores);
        toast.success('Categoría actualizada.');
      } else {
        await crearCategoria(valores);
        toast.success('Categoría creada. Asígnela a sus exámenes desde «Editar».');
      }
      cancelarEdicion();
      await cargar();
      onCambiadas?.();
    } catch (problema) {
      setError(problema.message);
    } finally {
      setGuardando(false);
    }
  }

  /** El error sube al diálogo de confirmación, que lo muestra sin cerrarse. */
  async function eliminar() {
    await eliminarCategoria(eliminando.id);
    toast.success('Categoría eliminada. Sus exámenes quedaron sin categoría.');
    if (editando?.id === eliminando.id) cancelarEdicion();
    await cargar();
    onCambiadas?.();
  }

  return (
    <>
      <Dialog open={abierto} onOpenChange={(valor) => !valor && onCerrar()}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Categorías de exámenes</DialogTitle>
            <DialogDescription>
              La indicación de una categoría le llega una sola vez a quien tenga cualquiera de sus
              exámenes, aunque traiga varios.
            </DialogDescription>
          </DialogHeader>

          <form className="flex flex-col gap-4 rounded-lg border p-4" onSubmit={guardar} noValidate>
            <p className="rotulo">{editando ? `Editar «${editando.nombre}»` : 'Nueva categoría'}</p>

            <CampoFormulario id="categoria-nombre" etiqueta="Nombre" error={error} requerido>
              {(props) => (
                <Input
                  {...props}
                  maxLength={80}
                  placeholder="Sangre"
                  value={valores.nombre}
                  onChange={(evento) => {
                    setValores((previo) => ({ ...previo, nombre: evento.target.value }));
                    setError(null);
                  }}
                />
              )}
            </CampoFormulario>

            <CampoFormulario
              id="categoria-indicaciones"
              etiqueta="Indicación para el recordatorio"
              ayuda="Opcional. Sin indicación, la categoría solo sirve para agrupar."
            >
              {(props) => (
                <Textarea
                  {...props}
                  rows={2}
                  maxLength={255}
                  placeholder="Debe venir con 12 horas de ayuno."
                  value={valores.indicaciones}
                  onChange={(evento) =>
                    setValores((previo) => ({ ...previo, indicaciones: evento.target.value }))
                  }
                />
              )}
            </CampoFormulario>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              {editando && (
                <Button type="button" variant="outline" onClick={cancelarEdicion}>
                  Cancelar edición
                </Button>
              )}
              <Button type="submit" disabled={guardando}>
                {editando ? null : <Plus aria-hidden="true" />}
                {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear categoría'}
              </Button>
            </div>
          </form>

          {categorias.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay categorías.</p>
          ) : (
            <ul aria-label="Categorías" className="flex flex-col">
              {categorias.map((categoria) => (
                <li
                  key={categoria.id}
                  className="flex items-start justify-between gap-3 border-b border-linea py-3 last:border-b-0"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{categoria.nombre}</span>
                      <Badge variant="secondary">
                        {Number(categoria.total_examenes) === 1
                          ? '1 examen'
                          : `${Number(categoria.total_examenes ?? 0)} exámenes`}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {categoria.indicaciones || 'Sin indicación.'}
                    </p>
                  </div>

                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      title="Editar"
                      onClick={() => empezarEdicion(categoria)}
                    >
                      <Pencil aria-hidden="true" />
                      <span className="sr-only">Editar {categoria.nombre}</span>
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      title="Eliminar"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setEliminando(categoria)}
                    >
                      <Trash2 aria-hidden="true" />
                      <span className="sr-only">Eliminar {categoria.nombre}</span>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      <DialogoConfirmacion
        abierto={Boolean(eliminando)}
        onCerrar={() => setEliminando(null)}
        onConfirmar={eliminar}
        titulo={`¿Eliminar la categoría "${eliminando?.nombre}"?`}
        descripcion="Sus exámenes no se borran: se quedan sin categoría y dejan de llevar su indicación en el recordatorio."
        textoConfirmar="Eliminar"
        destructivo
      />
    </>
  );
}

export default CategoriasDialog;
