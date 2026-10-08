import { useEffect, useState } from 'react';
import { CalendarClock, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';

import CampoFormulario from '@/components/CampoFormulario';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
import { SelectorFecha } from '@/components/ui/selector-fecha';
import { useConfiguracionAgenda } from '@/hooks/useConfiguracionAgenda';
import { actualizarCita } from '@/services/cita.service';
import { motivoDiaCerrado } from '@/lib/calendario';
import { fechaLarga, hoyISO } from '@/lib/formato';

/**
 * Cambio de fecha u hora de una cita ya creada.
 *
 * Sirve también para reagendar una cita cancelada: en ese caso vuelve a estado
 * pendiente y recupera su espacio del día, así que el backend revalida la
 * vigencia de la orden y el límite diario.
 */
function ReprogramarDialog({ abierto, onCerrar, cita, onGuardada }) {
  const [valores, setValores] = useState({ fecha: '', hora: '' });
  const [rechazo, setRechazo] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const cancelada = cita?.estado === 'CANCELADA';
  const configuracion = useConfiguracionAgenda(abierto);

  useEffect(() => {
    if (!abierto || !cita) return;

    setValores({ fecha: cita.fecha, hora: String(cita.hora).slice(0, 5) });
    setRechazo(null);
  }, [abierto, cita]);

  async function enviar(evento) {
    evento.preventDefault();
    setGuardando(true);
    setRechazo(null);

    try {
      await actualizarCita(cita.id, valores);
      toast.success(cancelada ? 'Cita reagendada y reactivada.' : 'Cita reprogramada.');
      onGuardada?.();
      onCerrar();
    } catch (error) {
      if (error.detalles?.motivo) {
        setRechazo({ mensaje: error.message, ...error.detalles });
      } else {
        toast.error(error.message);
      }
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={(valor) => !valor && onCerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{cancelada ? 'Reagendar cita cancelada' : 'Reprogramar cita'}</DialogTitle>
          <DialogDescription>
            {cita?.paciente_nombre} — la orden vence el {fechaLarga(cita?.fecha_vencimiento)}
            {cita?.fecha_cita_igss &&
              cita.fecha_limite !== cita.fecha_vencimiento &&
              ` y tiene cita en el IGSS el ${fechaLarga(cita.fecha_cita_igss)}`}
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={enviar} noValidate>
          {cancelada && (
            <p className="text-sm text-muted-foreground">
              La cita volverá a estado <strong>pendiente</strong> y ocupará de nuevo un espacio del
              día elegido.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <CampoFormulario id="reprogramar-fecha" etiqueta="Nueva fecha" requerido>
              {(props) => (
                <SelectorFecha
                  {...props}
                  min={hoyISO()}
                  max={cita?.fecha_limite ?? cita?.fecha_vencimiento}
                  diaCerrado={(iso) => motivoDiaCerrado(iso, configuracion)}
                  value={valores.fecha}
                  onChange={(evento) =>
                    setValores((previo) => ({ ...previo, fecha: evento.target.value }))
                  }
                />
              )}
            </CampoFormulario>

            <CampoFormulario id="reprogramar-hora" etiqueta="Nueva hora" requerido>
              {(props) => (
                <Input
                  {...props}
                  type="time"
                  value={valores.hora}
                  onChange={(evento) =>
                    setValores((previo) => ({ ...previo, hora: evento.target.value }))
                  }
                />
              )}
            </CampoFormulario>
          </div>

          {rechazo && (
            <Alert variant="destructive">
              <TriangleAlert aria-hidden="true" />
              <AlertTitle>No se pudo reprogramar</AlertTitle>
              <AlertDescription>
                <p>{rechazo.mensaje}</p>

                {rechazo.fechas_sugeridas?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {rechazo.fechas_sugeridas.map(({ fecha, disponibles }) => (
                      <Button
                        key={fecha}
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setValores((previo) => ({ ...previo, fecha }));
                          setRechazo(null);
                        }}
                      >
                        <CalendarClock aria-hidden="true" />
                        {fechaLarga(fecha)}
                        <Badge variant="secondary">{disponibles} libres</Badge>
                      </Button>
                    ))}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCerrar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default ReprogramarDialog;
