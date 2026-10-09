import { useState } from 'react';
import { CalendarClock, Check, Eye, MessageCircle, Pencil, RotateCcw, Trash2, UserX, X } from 'lucide-react';
import { toast } from 'sonner';

import DialogoConfirmacion from '@/components/DialogoConfirmacion';
import PacienteDetalleDialog from '@/components/pacientes/PacienteDetalleDialog';
import { Button } from '@/components/ui/button';
import { MenuAcciones, OpcionMenu, SeparadorMenu } from '@/components/ui/menu-acciones';
import { cambiarEstadoCita, eliminarCita } from '@/services/cita.service';
import { obtenerPaciente } from '@/services/paciente.service';
import { enviarRecordatorioDeCita } from '@/services/recordatorio.service';
import { hoyISO } from '@/lib/formato';

/**
 * Acciones de una cita (requisito 16).
 *
 * La primera transición posible queda a la vista como botón; el resto vive en el
 * menú. Con todas sueltas, la columna se envolvía y las filas quedaban con los
 * botones apilados.
 *
 * Solo se ofrecen las transiciones que el backend permite desde el estado
 * actual; aun así, el backend vuelve a comprobarlas.
 */
const ACCIONES = {
  PENDIENTE: [
    { estado: 'CONFIRMADA', texto: 'Confirmar', icono: Check },
    { estado: 'CANCELADA', texto: 'Cancelar', icono: X },
  ],
  CONFIRMADA: [
    { estado: 'ATENDIDA', texto: 'Atendida', icono: Check },
    { estado: 'NO_ASISTIO', texto: 'No asistió', icono: UserX },
    { estado: 'CANCELADA', texto: 'Cancelar', icono: X },
  ],
  // Una cancelada se puede reactivar: recupera su cupo, así que el backend
  // revalida vigencia y límite diario antes de aceptarla.
  CANCELADA: [{ estado: 'PENDIENTE', texto: 'Reactivar', icono: RotateCcw }],
};

/** Atendida y no asistió ya no se reprograman: su desenlace ocurrió. */
const REPROGRAMABLES = ['PENDIENTE', 'CONFIRMADA', 'CANCELADA'];

/** Solo tiene sentido recordar una cita que todavía va a ocurrir. */
const RECORDABLES = ['PENDIENTE', 'CONFIRMADA'];

function AccionesCita({ cita, onCambiada, onReprogramar, onEditar, onEliminada, onNuevaCita }) {
  const [procesando, setProcesando] = useState(null);
  /** Qué espera confirmación: `null`, `'CANCELAR'` o `'ELIMINAR'`. */
  const [confirmando, setConfirmando] = useState(null);
  /** Paciente cargado para la ficha; `null` mientras no se ha pedido. */
  const [ficha, setFicha] = useState(null);

  const cancelada = cita.estado === 'CANCELADA';

  // Reactivarla la deja con su fecha original: si esa fecha ya pasó, la única
  // salida es reagendarla a otro día.
  const caducada = cancelada && cita.fecha < hoyISO();
  const [principal, ...secundarias] = caducada ? [] : (ACCIONES[cita.estado] ?? []);

  const puedeReprogramar = Boolean(onReprogramar) && REPROGRAMABLES.includes(cita.estado);
  // Mismo criterio que reprogramar: lo atendido o no asistido ya no se toca.
  const puedeEditar = Boolean(onEditar) && REPROGRAMABLES.includes(cita.estado);
  // A quien no tiene WhatsApp se le avisa por llamada: el envío solo fallaría.
  const puedeRecordar = RECORDABLES.includes(cita.estado) && cita.paciente_tiene_whatsapp !== 0;

  /**
   * Cancelar y eliminar se parecen demasiado en el menú como para dispararlas
   * de un clic: las dos abren su diálogo. Las demás transiciones son inocuas y
   * reversibles, así que se aplican directas.
   */
  function elegir(estado, texto) {
    if (estado === 'CANCELADA') {
      setConfirmando('CANCELAR');
      return;
    }

    aplicar(estado, texto);
  }

  async function aplicar(estado, texto, motivo) {
    setProcesando(estado);

    try {
      await cambiarEstadoCita(cita.id, estado, motivo);
      toast.success(`Cita marcada como "${texto.toLowerCase()}".`);
      onCambiada?.();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setProcesando(null);
    }
  }

  async function recordar() {
    setProcesando('RECORDATORIO');

    try {
      const { enviado, recordatorio } = await enviarRecordatorioDeCita(cita.id);

      if (enviado) {
        toast.success(`Recordatorio enviado a ${cita.paciente_nombre}.`);
      } else {
        toast.error(
          `No se pudo enviar el recordatorio: ${recordatorio?.error_mensaje ?? 'WhatsApp no respondió.'}`,
          { duration: 8000 },
        );
      }

      onCambiada?.();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setProcesando(null);
    }
  }

  /**
   * La ficha se pide entera al abrirla y no se arma con lo que trae la cita:
   * la fila solo lleva nombre, teléfono y si tiene WhatsApp, mientras que la
   * ficha enseña también el DPI y las notas. Al mostrador le hace falta poder
   * comprobar quién es la persona sin salirse de la agenda.
   */
  async function verFicha() {
    setProcesando('FICHA');

    try {
      setFicha(await obtenerPaciente(cita.paciente_id));
    } catch (error) {
      toast.error(error.message);
    } finally {
      setProcesando(null);
    }
  }

  /**
   * El error no se atrapa: `DialogoConfirmacion` lo muestra dentro y deja el
   * diálogo abierto, que es justo lo que hace falta si la contraseña falla.
   */
  async function eliminar({ contrasena }) {
    await eliminarCita(cita.id, contrasena);
    toast.success('Cita eliminada.');
    (onEliminada ?? onCambiada)?.();
  }

  const ocupado = procesando !== null;

  return (
    <div className="flex items-center justify-end gap-1">
      {principal && (
        <Button
          size="sm"
          variant="secondary"
          disabled={ocupado}
          onClick={() => elegir(principal.estado, principal.texto)}
        >
          <principal.icono aria-hidden="true" />
          {principal.texto}
        </Button>
      )}

      <MenuAcciones etiqueta={`Acciones de la cita de ${cita.paciente_nombre}`} disabled={ocupado}>
        <OpcionMenu icono={Eye} onClick={verFicha}>
          Ver ficha del paciente
        </OpcionMenu>

        <SeparadorMenu />

        {secundarias.map(({ estado, texto, icono }) => (
          <OpcionMenu key={estado} icono={icono} onClick={() => elegir(estado, texto)}>
            {texto}
          </OpcionMenu>
        ))}

        {puedeEditar && (
          <OpcionMenu icono={Pencil} onClick={() => onEditar(cita)}>
            Editar exámenes y notas
          </OpcionMenu>
        )}

        {puedeReprogramar && (
          <OpcionMenu icono={CalendarClock} onClick={() => onReprogramar(cita)}>
            {cancelada ? 'Reagendar' : 'Reprogramar'}
          </OpcionMenu>
        )}

        {puedeRecordar && (
          <OpcionMenu icono={MessageCircle} onClick={recordar}>
            Enviar recordatorio
          </OpcionMenu>
        )}

        <SeparadorMenu />

        <OpcionMenu icono={Trash2} variante="destructiva" onClick={() => setConfirmando('ELIMINAR')}>
          Eliminar cita
        </OpcionMenu>
      </MenuAcciones>

      <PacienteDetalleDialog
        abierto={Boolean(ficha)}
        paciente={ficha}
        onCerrar={() => setFicha(null)}
        onNuevaCita={onNuevaCita}
      />

      <DialogoConfirmacion
        abierto={confirmando === 'CANCELAR'}
        onCerrar={() => setConfirmando(null)}
        onConfirmar={({ valor }) => aplicar('CANCELADA', 'Cancelada', valor)}
        titulo={`¿Cancelar la cita de ${cita.paciente_nombre}?`}
        descripcion="La cita se conserva en el historial marcada como cancelada, su espacio vuelve a quedar libre y podrá reactivarla o reagendarla más adelante. No se borra nada."
        textoConfirmar="Cancelar la cita"
        campo={{
          etiqueta: 'Motivo (opcional)',
          ayuda: 'Queda anotado en la cita. Ejemplo: «el paciente avisó que no puede».',
        }}
      />

      <DialogoConfirmacion
        abierto={confirmando === 'ELIMINAR'}
        onCerrar={() => setConfirmando(null)}
        onConfirmar={eliminar}
        titulo={`¿Eliminar la cita de ${cita.paciente_nombre}?`}
        descripcion="Se borra del historial y no se puede deshacer. Es para las citas creadas por error: si el paciente simplemente no vendrá, vuelva y use «Cancelar»."
        textoConfirmar="Eliminar definitivamente"
        destructivo
        pedirContrasena
      />
    </div>
  );
}

export default AccionesCita;
