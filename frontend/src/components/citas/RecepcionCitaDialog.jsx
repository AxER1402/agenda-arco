import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Plus, TriangleAlert, UserRoundPlus } from 'lucide-react';
import { toast } from 'sonner';

import CampoFormulario from '@/components/CampoFormulario';
import ExamenFormDialog from '@/components/examenes/ExamenFormDialog';
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
import { SelectNativo } from '@/components/ui/select-nativo';
import { Textarea } from '@/components/ui/textarea';
import { useTerminoRetrasado } from '@/hooks/useTerminoRetrasado';
import { consultarDisponibilidad, recibirPaciente } from '@/services/cita.service';
import { calcularVencimiento, listarExamenes } from '@/services/catalogo.service';
import { buscarPorTelefono } from '@/services/paciente.service';
import { fechaLarga, hoyISO } from '@/lib/formato';
import {
  esTelefonoValido,
  normalizarTelefono,
  validarDpi,
  validarFormulario,
  validarNombre,
  validarObligatorio,
  validarTelefono,
} from '@/lib/validaciones';

const VACIO = {
  telefono: '',
  nombreCompleto: '',
  dpi: '',
  // '' = no se preguntó. El backend lo guarda como "desconocido".
  tieneWhatsapp: '',
  numeroOrden: '',
  fechaRecepcion: hoyISO(),
  fecha: '',
  hora: '',
  notas: '',
};

/** Lo que el paciente responde cuando se le pregunta por su WhatsApp. */
const RESPUESTAS_WHATSAPP = [
  { valor: 'true', texto: 'Sí tiene' },
  { valor: 'false', texto: 'No tiene' },
  { valor: '', texto: 'No se preguntó' },
];

/** El dato guardado del paciente, en el formato del selector. */
function whatsappComoTexto(paciente) {
  if (!paciente || paciente.tiene_whatsapp === null || paciente.tiene_whatsapp === undefined) {
    return '';
  }
  return paciente.tiene_whatsapp ? 'true' : 'false';
}

/**
 * Recepción de un paciente en el mostrador: el único camino para crear citas.
 *
 * Sigue el orden real de la conversación con la persona que llega:
 *
 *   teléfono → ¿ya viene aquí? → qué exámenes trae → desde cuándo tiene la
 *   orden → qué día se le da
 *
 * No hay que buscar al paciente en una lista ni registrarle antes la orden del
 * IGSS: se escribe el número, y si ya está fichado sus datos se rellenan solos.
 * La orden nace con la cita, con los exámenes que el paciente trae ese día.
 *
 * La fecha de cita se propone lo más cerca posible del vencimiento, que es como
 * trabaja el laboratorio, pero se puede cambiar por cualquier otra válida.
 */
function RecepcionCitaDialog({ abierto, onCerrar, onGuardada, pacienteInicial = null }) {
  const [valores, setValores] = useState(VACIO);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [rechazo, setRechazo] = useState(null);

  // Paciente: null mientras no se sepa si el número corresponde a alguien.
  const [coincidencias, setCoincidencias] = useState([]);
  const [seleccionado, setSeleccionado] = useState(null);
  const [buscando, setBuscando] = useState(false);

  const [examenes, setExamenes] = useState([]);
  const [seleccionados, setSeleccionados] = useState([]);
  const [nuevoExamen, setNuevoExamen] = useState(false);

  const [vencimiento, setVencimiento] = useState(null);
  const [disponibilidad, setDisponibilidad] = useState(null);

  const telefonoRetrasado = useTerminoRetrasado(valores.telefono, 400);
  const telefonoBuscable = useMemo(
    () => esTelefonoValido(telefonoRetrasado),
    [telefonoRetrasado],
  );

  // --- Carga inicial -------------------------------------------------------

  useEffect(() => {
    if (!abierto) return;

    setValores({
      ...VACIO,
      fechaRecepcion: hoyISO(),
      telefono: pacienteInicial?.telefono ?? '',
      nombreCompleto: pacienteInicial?.nombre_completo ?? '',
      dpi: pacienteInicial?.dpi ?? '',
      tieneWhatsapp: whatsappComoTexto(pacienteInicial),
    });
    setSeleccionado(pacienteInicial);
    setCoincidencias([]);
    setSeleccionados([]);
    setErrores({});
    setRechazo(null);
    setVencimiento(null);
    setDisponibilidad(null);

    listarExamenes()
      .then(setExamenes)
      .catch((error) => toast.error(error.message));
  }, [abierto, pacienteInicial]);

  // Al completar el teléfono se busca a quién pertenece.
  useEffect(() => {
    if (!abierto || pacienteInicial || !telefonoBuscable) {
      if (!pacienteInicial) setCoincidencias([]);
      return undefined;
    }

    let cancelado = false;
    setBuscando(true);

    buscarPorTelefono(normalizarTelefono(telefonoRetrasado))
      .then((encontrados) => {
        if (cancelado) return;
        setCoincidencias(encontrados);
        // Con un solo paciente en ese número, se toma sin preguntar: es el caso
        // habitual y ahorra un clic en el mostrador.
        if (encontrados.length === 1) elegir(encontrados[0]);
      })
      .catch(() => !cancelado && setCoincidencias([]))
      .finally(() => !cancelado && setBuscando(false));

    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, telefonoRetrasado, telefonoBuscable, pacienteInicial]);

  // La fecha de vencimiento y las fechas propuestas las calcula el backend.
  useEffect(() => {
    if (!abierto || !valores.fechaRecepcion) {
      setVencimiento(null);
      return undefined;
    }

    let cancelado = false;

    calcularVencimiento(valores.fechaRecepcion)
      .then((datos) => {
        if (cancelado) return;
        setVencimiento(datos);

        // Se propone la fecha con cupo más cercana al vencimiento, pero solo
        // mientras el usuario no haya elegido una a mano.
        setValores((previo) =>
          previo.fecha ? previo : { ...previo, fecha: datos.fechas_sugeridas?.[0]?.fecha ?? '' },
        );
      })
      .catch(() => !cancelado && setVencimiento(null));

    return () => {
      cancelado = true;
    };
  }, [abierto, valores.fechaRecepcion]);

  useEffect(() => {
    if (!valores.fecha) {
      setDisponibilidad(null);
      return undefined;
    }

    let cancelado = false;

    consultarDisponibilidad(valores.fecha)
      .then((datos) => !cancelado && setDisponibilidad(datos))
      .catch(() => !cancelado && setDisponibilidad(null));

    return () => {
      cancelado = true;
    };
  }, [valores.fecha]);

  // --- Interacción ---------------------------------------------------------

  function cambiar(campo) {
    return (evento) => {
      setValores((previo) => ({ ...previo, [campo]: evento.target.value }));
      setErrores((previo) => ({ ...previo, [campo]: undefined }));
      setRechazo(null);
    };
  }

  function elegir(paciente) {
    setSeleccionado(paciente);
    setValores((previo) => ({
      ...previo,
      nombreCompleto: paciente.nombre_completo,
      dpi: paciente.dpi ?? '',
      // Se parte de lo que ya se sabía de ese número; si hoy responden otra
      // cosa, el dato se corrige.
      tieneWhatsapp: whatsappComoTexto(paciente),
    }));
    setErrores((previo) => ({ ...previo, nombreCompleto: undefined, dpi: undefined }));
  }

  function olvidarPaciente() {
    setSeleccionado(null);
    setCoincidencias([]);
    setValores((previo) => ({ ...previo, nombreCompleto: '', dpi: '', tieneWhatsapp: '' }));
  }

  function alternarExamen(id) {
    setSeleccionados((previos) =>
      previos.includes(id) ? previos.filter((actual) => actual !== id) : [...previos, id],
    );
    setErrores((previo) => ({ ...previo, examenes: undefined }));
  }

  function agregarExamenNuevo(examen) {
    setExamenes((previos) => [...previos, examen]);
    setSeleccionados((previos) => [...previos, examen.id]);
  }

  async function enviar(evento) {
    evento.preventDefault();

    const encontrados = validarFormulario({
      telefono: validarTelefono(valores.telefono),
      nombreCompleto: validarNombre(valores.nombreCompleto),
      dpi: validarDpi(valores.dpi),
      fechaRecepcion: validarObligatorio(valores.fechaRecepcion, 'La fecha de recepción'),
      fecha: validarObligatorio(valores.fecha, 'La fecha de la cita'),
      hora: validarObligatorio(valores.hora, 'La hora'),
    });

    if (seleccionados.length === 0) {
      encontrados.examenes = 'Indique al menos un examen.';
    }

    if (Object.keys(encontrados).length > 0) {
      setErrores(encontrados);
      return;
    }

    setGuardando(true);
    setRechazo(null);

    try {
      const { avisos, paciente_registrado: registrado } = await recibirPaciente({
        ...(seleccionado
          ? { pacienteId: seleccionado.id }
          : {
              paciente: {
                nombreCompleto: valores.nombreCompleto,
                telefono: normalizarTelefono(valores.telefono),
                dpi: valores.dpi,
              },
            }),
        // Solo se envía si hubo respuesta: así no se borra lo que ya se sabía.
        ...(valores.tieneWhatsapp === ''
          ? {}
          : { tieneWhatsapp: valores.tieneWhatsapp === 'true' }),
        numeroOrden: valores.numeroOrden,
        fechaRecepcion: valores.fechaRecepcion,
        examenes: seleccionados,
        fecha: valores.fecha,
        hora: valores.hora,
        notas: valores.notas,
      });

      toast.success(registrado ? 'Paciente registrado y cita programada.' : 'Cita programada.');
      avisos?.forEach((aviso) => toast.warning(aviso, { duration: 8000 }));

      onGuardada?.();
      onCerrar();
    } catch (error) {
      // El backend explica el motivo y propone fechas: se muestran tal cual.
      if (error.detalles?.motivo) {
        setRechazo({ mensaje: error.message, ...error.detalles });
      } else {
        toast.error(error.message);
      }
    } finally {
      setGuardando(false);
    }
  }

  const sugeridas = rechazo?.fechas_sugeridas ?? vencimiento?.fechas_sugeridas ?? [];

  return (
    <>
      <Dialog open={abierto} onOpenChange={(valor) => !valor && onCerrar()}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nueva cita</DialogTitle>
            <DialogDescription>
              Escriba el teléfono del paciente. Si ya viene al laboratorio, sus datos se completan
              solos.
            </DialogDescription>
          </DialogHeader>

          <form className="flex flex-col gap-5" onSubmit={enviar} noValidate>
            {/* --- Paciente --- */}
            <fieldset className="flex flex-col gap-4">
              <legend className="rotulo mb-2">Paciente</legend>

              <div className="grid gap-4 sm:grid-cols-2">
                <CampoFormulario
                  id="recepcion-telefono"
                  etiqueta="Teléfono"
                  error={errores.telefono}
                  ayuda={buscando ? 'Buscando...' : 'Ocho dígitos'}
                  requerido
                >
                  {(props) => (
                    <Input
                      {...props}
                      inputMode="numeric"
                      maxLength={12}
                      value={valores.telefono}
                      onChange={(evento) => {
                        cambiar('telefono')(evento);
                        if (seleccionado && !pacienteInicial) olvidarPaciente();
                      }}
                      autoFocus
                    />
                  )}
                </CampoFormulario>

                <CampoFormulario
                  id="recepcion-nombre"
                  etiqueta="Nombre completo"
                  error={errores.nombreCompleto}
                  requerido
                >
                  {(props) => (
                    <Input
                      {...props}
                      value={valores.nombreCompleto}
                      onChange={cambiar('nombreCompleto')}
                      readOnly={Boolean(seleccionado)}
                    />
                  )}
                </CampoFormulario>
              </div>

              {seleccionado ? (
                <div className="flex flex-wrap items-center justify-between gap-2 border-2 border-trazo bg-secondary px-3 py-2">
                  <p className="text-sm">
                    Paciente ya registrado: <strong>{seleccionado.nombre_completo}</strong>
                  </p>
                  {!pacienteInicial && (
                    <Button type="button" size="sm" variant="ghost" onClick={olvidarPaciente}>
                      No es esta persona
                    </Button>
                  )}
                </div>
              ) : coincidencias.length > 1 ? (
                <div className="flex flex-col gap-2 border-2 border-trazo p-3">
                  <p className="text-sm font-medium">
                    Hay {coincidencias.length} pacientes con ese teléfono. ¿Cuál es?
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {coincidencias.map((candidato) => (
                      <Button
                        key={candidato.id}
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => elegir(candidato)}
                      >
                        {candidato.nombre_completo}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : (
                telefonoBuscable && (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <UserRoundPlus className="size-4" aria-hidden="true" />
                    Nadie usa ese número todavía: se registrará como paciente nuevo.
                  </p>
                )
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                {!seleccionado && (
                  <CampoFormulario
                    id="recepcion-dpi"
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
                )}

                {/* Se pregunta al paciente en el mostrador: de esto depende que
                    el recordatorio llegue solo o haya que llamarlo. */}
                <CampoFormulario
                  id="recepcion-whatsapp"
                  etiqueta="¿Este número tiene WhatsApp?"
                  ayuda={
                    valores.tieneWhatsapp === 'false'
                      ? 'Habrá que llamarle: aparecerá en el panel el día antes.'
                      : 'Pregúntele al paciente.'
                  }
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
              </div>
            </fieldset>

            {/* --- Orden del IGSS --- */}
            <fieldset className="flex flex-col gap-4">
              <legend className="rotulo mb-2">Orden del IGSS</legend>

              <div className="grid gap-4 sm:grid-cols-2">
                <CampoFormulario
                  id="recepcion-fecha-recepcion"
                  etiqueta="Fecha de recepción"
                  error={errores.fechaRecepcion}
                  ayuda="El día que el IGSS le entregó la orden"
                  requerido
                >
                  {(props) => (
                    <Input
                      {...props}
                      type="date"
                      max={hoyISO()}
                      value={valores.fechaRecepcion}
                      onChange={cambiar('fechaRecepcion')}
                    />
                  )}
                </CampoFormulario>

                <CampoFormulario id="recepcion-numero-orden" etiqueta="Número de orden">
                  {(props) => (
                    <Input
                      {...props}
                      placeholder="Opcional"
                      value={valores.numeroOrden}
                      onChange={cambiar('numeroOrden')}
                    />
                  )}
                </CampoFormulario>
              </div>

              {vencimiento && (
                <Alert variant={vencimiento.vencida ? 'destructive' : 'default'}>
                  <AlertDescription>
                    {vencimiento.vencida ? (
                      <>
                        Esa orden venció el{' '}
                        <strong>{fechaLarga(vencimiento.fecha_vencimiento)}</strong>: ya no se le
                        puede dar cita. El paciente necesita una orden nueva.
                      </>
                    ) : (
                      <>
                        Se puede recibir hasta el{' '}
                        <strong>{fechaLarga(vencimiento.fecha_vencimiento)}</strong> inclusive (
                        {vencimiento.meses_vigencia} meses desde la recepción). Ese mismo día
                        todavía vale; el siguiente ya no.
                      </>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">
                    Exámenes que trae<span className="ml-0.5 text-destructive">*</span>
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setNuevoExamen(true)}
                  >
                    <Plus aria-hidden="true" />
                    No está en la lista
                  </Button>
                </div>

                <div className="grid max-h-44 gap-1 overflow-y-auto border-2 border-trazo p-2 sm:grid-cols-2">
                  {examenes.length === 0 ? (
                    <p className="p-2 text-sm text-muted-foreground">
                      Todavía no hay exámenes en el catálogo.
                    </p>
                  ) : (
                    examenes.map((examen) => (
                      <label
                        key={examen.id}
                        className="flex cursor-pointer items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent"
                      >
                        <input
                          type="checkbox"
                          className="size-4 accent-[var(--primary)]"
                          checked={seleccionados.includes(examen.id)}
                          onChange={() => alternarExamen(examen.id)}
                        />
                        <span className="rotulo shrink-0">{examen.codigo}</span>
                        {examen.nombre}
                      </label>
                    ))
                  )}
                </div>

                {errores.examenes && (
                  <p className="text-xs font-medium text-destructive">{errores.examenes}</p>
                )}
              </div>
            </fieldset>

            {/* --- Cita --- */}
            <fieldset className="flex flex-col gap-4">
              <legend className="rotulo mb-2">Cita</legend>

              <div className="grid gap-4 sm:grid-cols-2">
                <CampoFormulario
                  id="recepcion-fecha"
                  etiqueta="Fecha de la cita"
                  error={errores.fecha}
                  requerido
                >
                  {(props) => (
                    <Input
                      {...props}
                      type="date"
                      min={hoyISO()}
                      max={vencimiento?.fecha_vencimiento}
                      value={valores.fecha}
                      onChange={cambiar('fecha')}
                    />
                  )}
                </CampoFormulario>

                <CampoFormulario
                  id="recepcion-hora"
                  etiqueta="Hora"
                  error={errores.hora}
                  requerido
                >
                  {(props) => (
                    <Input
                      {...props}
                      type="time"
                      value={valores.hora}
                      onChange={cambiar('hora')}
                    />
                  )}
                </CampoFormulario>
              </div>

              {sugeridas.length > 0 && (
                <div>
                  <p className="mb-2 text-xs text-muted-foreground">
                    Fechas con cupo más cercanas al vencimiento:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {sugeridas.map(({ fecha, disponibles }) => (
                      <Button
                        key={fecha}
                        type="button"
                        size="sm"
                        variant={valores.fecha === fecha ? 'secondary' : 'outline'}
                        onClick={() => {
                          setValores((previo) => ({ ...previo, fecha }));
                          setRechazo(null);
                          setErrores((previo) => ({ ...previo, fecha: undefined }));
                        }}
                      >
                        <CalendarClock aria-hidden="true" />
                        {fechaLarga(fecha)}
                        <Badge variant="secondary">{disponibles} libres</Badge>
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {disponibilidad && (
                <p className="text-xs text-muted-foreground">
                  {disponibilidad.laborable ? (
                    <>
                      Ese día quedan <strong>{disponibilidad.disponibles}</strong> espacios de{' '}
                      {disponibilidad.limite}.
                    </>
                  ) : (
                    'El laboratorio no atiende ese día.'
                  )}
                </p>
              )}

              <CampoFormulario id="recepcion-notas" etiqueta="Notas">
                {(props) => (
                  <Textarea {...props} rows={2} value={valores.notas} onChange={cambiar('notas')} />
                )}
              </CampoFormulario>
            </fieldset>

            {rechazo && (
              <Alert variant="destructive">
                <TriangleAlert aria-hidden="true" />
                <AlertTitle>No se pudo programar la cita</AlertTitle>
                <AlertDescription>
                  <p>{rechazo.mensaje}</p>
                  {rechazo.nota && <p className="mt-2 font-medium">{rechazo.nota}</p>}
                </AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onCerrar}>
                Cancelar
              </Button>
              <Button type="submit" disabled={guardando || vencimiento?.vencida}>
                {guardando ? 'Programando...' : 'Programar cita'}
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

export default RecepcionCitaDialog;
