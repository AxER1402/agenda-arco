import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import CampoFormulario from '@/components/CampoFormulario';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { actualizarExamen, crearExamen } from '@/services/catalogo.service';
import { validarFormulario, validarObligatorio } from '@/lib/validaciones';

const VACIO = { codigo: '', nombre: '', descripcion: '', indicaciones: '' };

/**
 * Alta y edición de un examen del catálogo.
 *
 * Se abre tanto desde la pantalla de exámenes como desde la recepción de una
 * cita: si el paciente trae un examen que nadie había registrado, se agrega en
 * el momento y queda disponible para todos.
 *
 * @param {object|null} examen Si viene, el formulario edita; si no, crea.
 * @param {(examen: object) => void} [onGuardado] Recibe el examen resultante,
 *   para que quien lo abrió pueda seleccionarlo enseguida.
 */
function ExamenFormDialog({ abierto, onCerrar, examen = null, onGuardado }) {
  const editando = Boolean(examen);

  const [valores, setValores] = useState(VACIO);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!abierto) return;

    setValores(
      examen
        ? {
            codigo: examen.codigo ?? '',
            nombre: examen.nombre ?? '',
            descripcion: examen.descripcion ?? '',
            indicaciones: examen.indicaciones ?? '',
          }
        : VACIO,
    );
    setErrores({});
  }, [abierto, examen]);

  function cambiar(campo) {
    return (evento) => {
      setValores((previo) => ({ ...previo, [campo]: evento.target.value }));
      setErrores((previo) => ({ ...previo, [campo]: undefined }));
    };
  }

  async function enviar(evento) {
    evento.preventDefault();

    const encontrados = validarFormulario({
      codigo: validarObligatorio(valores.codigo, 'El código del IGSS'),
      nombre: validarObligatorio(valores.nombre, 'El nombre'),
    });

    if (Object.keys(encontrados).length > 0) {
      setErrores(encontrados);
      return;
    }

    setGuardando(true);

    try {
      const guardado = editando
        ? await actualizarExamen(examen.id, valores)
        : await crearExamen(valores);

      toast.success(editando ? 'Examen actualizado.' : 'Examen agregado al catálogo.');
      onGuardado?.(guardado);
      onCerrar();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={(valor) => !valor && onCerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editando ? 'Editar examen' : 'Nuevo examen'}</DialogTitle>
          <DialogDescription>
            Los exámenes del catálogo son los que se pueden asignar a una cita.
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={enviar} noValidate>
          <CampoFormulario
            id="examen-codigo"
            etiqueta="Código del IGSS"
            error={errores.codigo}
            requerido
          >
            {(props) => (
              <Input
                {...props}
                value={valores.codigo}
                onChange={cambiar('codigo')}
                placeholder="HEM-001"
                autoFocus
              />
            )}
          </CampoFormulario>

          <CampoFormulario id="examen-nombre" etiqueta="Nombre" error={errores.nombre} requerido>
            {(props) => (
              <Input
                {...props}
                value={valores.nombre}
                onChange={cambiar('nombre')}
                placeholder="Hematología completa"
              />
            )}
          </CampoFormulario>

          <CampoFormulario id="examen-descripcion" etiqueta="Descripción">
            {(props) => (
              <Textarea
                {...props}
                rows={2}
                value={valores.descripcion}
                onChange={cambiar('descripcion')}
              />
            )}
          </CampoFormulario>

          <CampoFormulario
            id="examen-indicaciones"
            etiqueta="Indicación para el recordatorio"
            ayuda="Opcional. Se agrega al WhatsApp solo a quien tenga este examen en su cita."
          >
            {(props) => (
              <Textarea
                {...props}
                rows={2}
                maxLength={255}
                placeholder="La muestra no debe pasar más de 1 hora dentro del frasco."
                value={valores.indicaciones}
                onChange={cambiar('indicaciones')}
              />
            )}
          </CampoFormulario>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCerrar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default ExamenFormDialog;
