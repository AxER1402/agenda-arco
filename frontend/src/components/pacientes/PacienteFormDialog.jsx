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
import { SelectNativo } from '@/components/ui/select-nativo';
import { Textarea } from '@/components/ui/textarea';
import { crearPaciente, actualizarPaciente } from '@/services/paciente.service';
import {
  validarDpi,
  validarFormulario,
  validarNombre,
  validarTelefono,
} from '@/lib/validaciones';

const VACIO = { nombreCompleto: '', telefono: '', dpi: '', tieneWhatsapp: '', notas: '' };

const RESPUESTAS_WHATSAPP = [
  { valor: '', texto: 'Sin comprobar' },
  { valor: 'true', texto: 'Sí tiene' },
  { valor: 'false', texto: 'No tiene' },
];

/**
 * Alta y edición de pacientes.
 * @param {object|null} paciente Si viene, el formulario edita; si no, registra.
 */
function PacienteFormDialog({ abierto, onCerrar, paciente = null, onGuardado }) {
  const editando = Boolean(paciente);

  const [valores, setValores] = useState(VACIO);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!abierto) return;

    setValores(
      paciente
        ? {
            nombreCompleto: paciente.nombre_completo ?? '',
            telefono: paciente.telefono ?? '',
            dpi: paciente.dpi ?? '',
            tieneWhatsapp:
              paciente.tiene_whatsapp === null || paciente.tiene_whatsapp === undefined
                ? ''
                : String(Boolean(paciente.tiene_whatsapp)),
            notas: paciente.notas ?? '',
          }
        : VACIO,
    );
    setErrores({});
  }, [abierto, paciente]);

  function cambiar(campo) {
    return (evento) => {
      setValores((previo) => ({ ...previo, [campo]: evento.target.value }));
      setErrores((previo) => ({ ...previo, [campo]: undefined }));
    };
  }

  async function enviar(evento) {
    evento.preventDefault();

    const encontrados = validarFormulario({
      nombreCompleto: validarNombre(valores.nombreCompleto),
      telefono: validarTelefono(valores.telefono),
      dpi: validarDpi(valores.dpi),
    });

    if (Object.keys(encontrados).length > 0) {
      setErrores(encontrados);
      return;
    }

    setGuardando(true);

    // '' significa "sin comprobar", que en la base es NULL.
    const datos = {
      ...valores,
      tieneWhatsapp: valores.tieneWhatsapp === '' ? null : valores.tieneWhatsapp === 'true',
    };

    try {
      if (editando) {
        await actualizarPaciente(paciente.id, datos);
        toast.success('Paciente actualizado.');
      } else {
        const { avisos } = await crearPaciente(datos);
        toast.success('Paciente registrado.');
        avisos?.forEach((aviso) => toast.warning(aviso, { duration: 8000 }));
      }

      onGuardado?.();
      onCerrar();
    } catch (error) {
      toast.error(error.message);
      // El backend puede señalar el campo exacto que falló.
      if (Array.isArray(error.detalles)) {
        setErrores(
          Object.fromEntries(error.detalles.map((detalle) => [detalle.campo, detalle.mensaje])),
        );
      }
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={(valor) => !valor && onCerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editando ? 'Editar paciente' : 'Registrar paciente'}</DialogTitle>
          <DialogDescription>
            El teléfono se usa para enviar el recordatorio de la cita.
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={enviar} noValidate>
          <CampoFormulario
            id="nombreCompleto"
            etiqueta="Nombre completo"
            error={errores.nombreCompleto}
            requerido
          >
            {(props) => (
              <Input
                {...props}
                value={valores.nombreCompleto}
                onChange={cambiar('nombreCompleto')}
                autoFocus
              />
            )}
          </CampoFormulario>

          <CampoFormulario
            id="telefono"
            etiqueta="Teléfono"
            error={errores.telefono}
            ayuda="Ocho dígitos. Ejemplo: 55555555"
            requerido
          >
            {(props) => (
              <Input
                {...props}
                inputMode="numeric"
                maxLength={12}
                value={valores.telefono}
                onChange={cambiar('telefono')}
              />
            )}
          </CampoFormulario>

          <CampoFormulario
            id="dpi"
            etiqueta="DPI"
            error={errores.dpi}
            ayuda="Opcional. Si se registra, son 13 dígitos"
          >
            {(props) => (
              <Input
                {...props}
                inputMode="numeric"
                maxLength={17}
                placeholder="Opcional"
                value={valores.dpi}
                onChange={cambiar('dpi')}
              />
            )}
          </CampoFormulario>

          <CampoFormulario
            id="tieneWhatsapp"
            etiqueta="WhatsApp"
            ayuda="Si no tiene, habrá que llamarle en lugar de mandarle el recordatorio."
          >
            {(props) => (
              <SelectNativo
                {...props}
                value={valores.tieneWhatsapp}
                onChange={cambiar('tieneWhatsapp')}
              >
                {RESPUESTAS_WHATSAPP.map(({ valor, texto }) => (
                  <option key={texto} value={valor}>
                    {texto}
                  </option>
                ))}
              </SelectNativo>
            )}
          </CampoFormulario>

          <CampoFormulario id="notas" etiqueta="Notas" error={errores.notas}>
            {(props) => (
              <Textarea {...props} value={valores.notas} onChange={cambiar('notas')} rows={2} />
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

export default PacienteFormDialog;
