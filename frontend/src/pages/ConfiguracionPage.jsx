import { useCallback, useEffect, useState } from 'react';
import { QrCode, RefreshCw, Send, Settings, Unlink } from 'lucide-react';
import { toast } from 'sonner';

import CampoFormulario from '@/components/CampoFormulario';
import DialogoConfirmacion from '@/components/DialogoConfirmacion';
import MensajeRecordatorioCard from '@/components/configuracion/MensajeRecordatorioCard';
import EncabezadoModulo from '@/components/layout/EncabezadoModulo';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { actualizarConfiguracion, obtenerConfiguracion } from '@/services/catalogo.service';
import {
  desvincularWhatsapp,
  enviarRecordatoriosPendientes,
  obtenerEstadoWhatsapp,
  obtenerQrWhatsapp,
  prepararRecordatorios,
} from '@/services/recordatorio.service';

/**
 * Configuración del laboratorio y vinculación de WhatsApp.
 *
 * Esta pantalla no lista los recordatorios ya enviados: era una tabla que
 * crecía con cada cita de cada día y obligaba a traerse todo el historial cada
 * vez que se entraba a cambiar un horario. El estado de cada aviso se ve donde
 * hace falta —junto a la cita, en el panel y en la agenda—, y el resumen de
 * entregas está en el panel.
 */
function ConfiguracionPage() {
  const [configuracion, setConfiguracion] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const [whatsapp, setWhatsapp] = useState(null);
  const [qr, setQr] = useState(null);
  const [mostrandoQr, setMostrandoQr] = useState(false);
  const [confirmandoDesvincular, setConfirmandoDesvincular] = useState(false);

  const cargarConfiguracion = useCallback(async () => {
    try {
      setConfiguracion(await obtenerConfiguracion());
    } catch (error) {
      toast.error(error.message);
    }
  }, []);

  const cargarWhatsapp = useCallback(async () => {
    try {
      setWhatsapp(await obtenerEstadoWhatsapp());
    } catch {
      setWhatsapp({ disponible: false, estado: 'SERVICIO_NO_DISPONIBLE' });
    }
  }, []);

  useEffect(() => {
    cargarConfiguracion();
    cargarWhatsapp();
  }, [cargarConfiguracion, cargarWhatsapp]);

  function cambiar(clave) {
    return (evento) =>
      setConfiguracion((previo) => ({ ...previo, [clave]: evento.target.value }));
  }

  async function guardar(evento) {
    evento.preventDefault();
    setGuardando(true);

    try {
      const actualizada = await actualizarConfiguracion({
        limite_diario_pacientes: Number(configuracion.limite_diario_pacientes),
        vigencia_orden_meses: Number(configuracion.vigencia_orden_meses),
        hora_apertura: configuracion.hora_apertura,
        hora_cierre: configuracion.hora_cierre,
        intervalo_citas_minutos: Number(configuracion.intervalo_citas_minutos),
        hora_recordatorios: configuracion.hora_recordatorios,
      });

      setConfiguracion(actualizada);
      toast.success('Configuración actualizada.');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setGuardando(false);
    }
  }

  const refrescarQr = useCallback(async ({ avisar = false } = {}) => {
    try {
      const datos = await obtenerQrWhatsapp();
      setQr(datos);

      if (!datos && avisar) {
        toast.info('No hay un código QR pendiente. La sesión puede estar ya vinculada.');
      }
    } catch (error) {
      if (avisar) toast.error(error.message);
    }
  }, []);

  /**
   * WhatsApp renueva el código cada pocos segundos y el anterior deja de
   * servir. Mientras el QR esté visible y la sesión sin vincular, se vuelve a
   * pedir para que el que se muestra siempre sea escaneable.
   */
  useEffect(() => {
    if (!mostrandoQr || whatsapp?.listo) return undefined;

    refrescarQr();
    const intervalo = setInterval(() => {
      refrescarQr();
      cargarWhatsapp();
    }, 12000);

    return () => clearInterval(intervalo);
  }, [mostrandoQr, whatsapp?.listo, refrescarQr, cargarWhatsapp]);

  /**
   * Al desvincular, el servicio se queda pidiendo un código nuevo: se abre el
   * QR en el acto para que quien cambia de teléfono lo escanee sin tener que
   * buscar el botón. El error no se atrapa aquí a propósito, para que
   * `DialogoConfirmacion` lo enseñe dentro y no dé por hecho que funcionó.
   */
  async function desvincular() {
    const { mensaje } = await desvincularWhatsapp();

    toast.success(mensaje);
    setQr(null);
    setMostrandoQr(true);
    await cargarWhatsapp();
  }

  async function ejecutarRecordatorios() {
    try {
      const preparacion = await prepararRecordatorios();
      const envio = await enviarRecordatoriosPendientes();

      toast.success(
        `Preparados: ${preparacion.preparados}. Enviados: ${envio.enviados}. Fallidos: ${envio.fallidos}.`,
      );
    } catch (error) {
      toast.error(error.message);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <EncabezadoModulo
        icono={Settings}
        titulo="Configuración"
        descripcion="Parámetros de la agenda y vinculación de WhatsApp."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Agenda</CardTitle>
          <CardDescription>
            El límite diario controla cuántos pacientes se pueden agendar por día. La hora de los
            recordatorios se aplica en cuanto se guarda, sin reiniciar nada.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {configuracion && (
            <form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" onSubmit={guardar}>
              <CampoFormulario id="limite" etiqueta="Límite diario de pacientes">
                {(props) => (
                  <Input
                    {...props}
                    type="number"
                    min={1}
                    max={500}
                    value={configuracion.limite_diario_pacientes}
                    onChange={cambiar('limite_diario_pacientes')}
                  />
                )}
              </CampoFormulario>

              <CampoFormulario
                id="vigencia"
                etiqueta="Vigencia de las órdenes (meses)"
                ayuda="El IGSS entrega órdenes con tres meses de vigencia."
              >
                {(props) => (
                  <Input
                    {...props}
                    type="number"
                    min={1}
                    max={24}
                    value={configuracion.vigencia_orden_meses}
                    onChange={cambiar('vigencia_orden_meses')}
                  />
                )}
              </CampoFormulario>

              <CampoFormulario id="intervalo" etiqueta="Intervalo entre citas (minutos)">
                {(props) => (
                  <Input
                    {...props}
                    type="number"
                    min={5}
                    max={120}
                    value={configuracion.intervalo_citas_minutos}
                    onChange={cambiar('intervalo_citas_minutos')}
                  />
                )}
              </CampoFormulario>

              <CampoFormulario id="apertura" etiqueta="Hora de apertura">
                {(props) => (
                  <Input
                    {...props}
                    type="time"
                    value={configuracion.hora_apertura}
                    onChange={cambiar('hora_apertura')}
                  />
                )}
              </CampoFormulario>

              <CampoFormulario id="cierre" etiqueta="Hora de cierre">
                {(props) => (
                  <Input
                    {...props}
                    type="time"
                    value={configuracion.hora_cierre}
                    onChange={cambiar('hora_cierre')}
                  />
                )}
              </CampoFormulario>

              <CampoFormulario
                id="hora-recordatorios"
                etiqueta="Hora de los recordatorios"
                ayuda="Se envían el día anterior a la cita, a esta hora."
              >
                {(props) => (
                  <Input
                    {...props}
                    type="time"
                    value={configuracion.hora_recordatorios}
                    onChange={cambiar('hora_recordatorios')}
                  />
                )}
              </CampoFormulario>

              <div className="flex items-end">
                <Button type="submit" disabled={guardando}>
                  {guardando ? 'Guardando...' : 'Guardar cambios'}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <MensajeRecordatorioCard />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-xl">WhatsApp</CardTitle>
              <CardDescription>
                Cuenta usada para enviar los recordatorios de cita.
              </CardDescription>
            </div>
            <Badge variant={whatsapp?.listo ? 'success' : 'destructive'}>
              {whatsapp?.listo ? 'Vinculado' : (whatsapp?.estado ?? 'Sin conexión')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={cargarWhatsapp}>
              <RefreshCw aria-hidden="true" />
              Actualizar estado
            </Button>
            {!whatsapp?.listo && (
              <Button
                size="sm"
                variant={mostrandoQr ? 'secondary' : 'outline'}
                onClick={() => {
                  setMostrandoQr((visible) => !visible);
                  if (!mostrandoQr) refrescarQr({ avisar: true });
                }}
              >
                <QrCode aria-hidden="true" />
                {mostrandoQr ? 'Ocultar código QR' : 'Vincular WhatsApp'}
              </Button>
            )}
            <Button size="sm" onClick={ejecutarRecordatorios}>
              <Send aria-hidden="true" />
              Preparar y enviar recordatorios de mañana
            </Button>

            {whatsapp?.listo && (
              <Button size="sm" variant="outline" onClick={() => setConfirmandoDesvincular(true)}>
                <Unlink aria-hidden="true" />
                Desvincular WhatsApp
              </Button>
            )}
          </div>

          {mostrandoQr && !whatsapp?.listo && (
            <Alert>
              <AlertTitle>Escanee este código con el WhatsApp del laboratorio</AlertTitle>
              <AlertDescription>
                <ol className="mb-3 ml-4 list-decimal text-xs [&>li]:mt-0.5">
                  <li>Abra WhatsApp en el teléfono del laboratorio.</li>
                  <li>Entre en Ajustes → Dispositivos vinculados.</li>
                  <li>Pulse «Vincular un dispositivo» y apunte a este código.</li>
                </ol>

                {qr?.imagen ? (
                  <figure className="flex flex-col items-center gap-2">
                    <img
                      src={qr.imagen}
                      alt="Código QR para vincular la cuenta de WhatsApp del laboratorio"
                      className="size-64 border-2 border-trazo bg-white p-2"
                      width={320}
                      height={320}
                    />
                    <figcaption className="text-xs text-muted-foreground">
                      El código se renueva solo cada pocos segundos.
                    </figcaption>
                  </figure>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Generando el código... Si no aparece, revise que el servicio
                    <code className="mx-1">arco-whatsapp</code>
                    esté en ejecución.
                  </p>
                )}
              </AlertDescription>
            </Alert>
          )}

          {whatsapp?.listo && (
            <p className="text-sm text-muted-foreground">
              La cuenta ya está vinculada. Para cambiar de teléfono, desvincúlela aquí y escanee el
              código nuevo con la cuenta que vaya a usar.
            </p>
          )}
        </CardContent>
      </Card>

      <DialogoConfirmacion
        abierto={confirmandoDesvincular}
        onCerrar={() => setConfirmandoDesvincular(false)}
        onConfirmar={desvincular}
        titulo="¿Desvincular la cuenta de WhatsApp?"
        descripcion="Mientras no se vincule otra cuenta, los recordatorios dejan de salir y habrá que llamar a los pacientes. Para volver a activarlos basta con escanear el código QR que aparecerá aquí mismo."
        textoConfirmar="Desvincular"
        destructivo
      />
    </div>
  );
}

export default ConfiguracionPage;
