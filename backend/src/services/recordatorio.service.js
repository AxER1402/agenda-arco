/**
 * Recordatorios de cita por WhatsApp (requisitos 18 y 19).
 *
 * Flujo:
 *   citas de mañana → generar mensaje → registrar PENDIENTE →
 *   pedir el envío al whatsapp-service → registrar ENVIADO o FALLIDO
 *
 * El sistema no asume que todos los pacientes tengan WhatsApp: un número sin
 * WhatsApp se registra como FALLIDO con su motivo, y el paciente queda marcado
 * para que el personal lo contacte por otro medio.
 */
const recordatorioModel = require('../models/recordatorio.model');
const citaModel = require('../models/cita.model');
const pacienteModel = require('../models/paciente.model');
const configuracionService = require('./configuracion.service');
const whatsappClient = require('./whatsapp.client');
const AppError = require('../utils/AppError');
const fechas = require('../utils/fechas');

/** Motivos de fallo que significan "este número no tiene WhatsApp". */
const MOTIVOS_SIN_WHATSAPP = new Set(['NUMERO_SIN_WHATSAPP']);

/** Cita de ejemplo para enseñar cómo queda la plantilla mientras se edita. */
const CITA_DE_EJEMPLO = {
  paciente_nombre: 'María González',
  fecha: '2026-08-12',
  hora: '09:30:00',
  examenes: [{ nombre: 'Hematología completa' }, { nombre: 'Glucosa' }],
};

/**
 * Sustituye los marcadores de la plantilla por los datos de la cita.
 *
 * Una línea que solo existía por sus marcadores desaparece si todos quedan
 * vacíos: así «{etiqueta_examenes}: {examenes}» no deja unos dos puntos sueltos
 * cuando la cita no tiene exámenes.
 *
 * @param {string} plantilla
 * @param {Record<string, string>} valores
 * @returns {string}
 */
function renderizarPlantilla(plantilla, valores) {
  const MARCADOR = /\{\s*([^{}]*?)\s*\}/g;

  return plantilla
    .split('\n')
    .filter((linea) => {
      const marcadores = linea.match(MARCADOR);
      if (!marcadores) return true;

      // Se conserva si algún marcador trajo contenido, o si la línea tiene
      // texto propio más allá de los marcadores y sus separadores.
      const traeContenido = marcadores.some(
        (marcador) => valores[marcador.replace(MARCADOR, '$1')],
      );
      const resto = linea.replace(MARCADOR, '').replace(/[\s:,;.-]/g, '');

      return traeContenido || resto.length > 0;
    })
    .join('\n')
    .replace(MARCADOR, (coincidencia, nombre) => valores[nombre] ?? coincidencia);
}

/**
 * Construye el texto del recordatorio.
 * Es una función pura para poder probarla sin base de datos ni WhatsApp.
 *
 * @param {object} cita Cita con paciente y exámenes.
 * @param {string} nombreLaboratorio
 * @param {string} plantilla Texto con marcadores; por defecto, el del sistema.
 * @returns {string}
 */
function generarMensaje(
  cita,
  nombreLaboratorio = 'El Arco Laboratorios',
  plantilla = configuracionService.PLANTILLA_POR_DEFECTO,
) {
  const examenes = (cita.examenes ?? []).map((examen) => examen.nombre);

  return renderizarPlantilla(plantilla, {
    paciente: cita.paciente_nombre ?? '',
    laboratorio: nombreLaboratorio,
    fecha: fechas.aFormatoLocal(cita.fecha),
    hora: fechas.horaAFormatoLocal(String(cita.hora)),
    examenes: examenes.join(', '),
    etiqueta_examenes: examenes.length === 0 ? '' : examenes.length === 1 ? 'Examen' : 'Exámenes',
  });
}

/**
 * Lee lo que hace falta para redactar un recordatorio.
 * Se pide de una vez porque los tres valores van siempre juntos.
 */
async function obtenerAjustesDelMensaje() {
  const [nombreLaboratorio, plantilla, horaEnvio] = await Promise.all([
    configuracionService.obtener(configuracionService.CLAVES.NOMBRE_LABORATORIO),
    configuracionService.obtener(configuracionService.CLAVES.PLANTILLA_RECORDATORIO),
    configuracionService.obtener(configuracionService.CLAVES.HORA_RECORDATORIOS),
  ]);

  return { nombreLaboratorio, plantilla, horaEnvio };
}

/**
 * Registra como PENDIENTE los recordatorios de las citas de una fecha.
 * No envía nada: separar ambos pasos permite revisar qué se va a mandar y
 * hace que un fallo de WhatsApp no impida registrar el recordatorio.
 *
 * @param {string} fecha Fecha de las citas (por defecto, mañana).
 */
async function prepararParaFecha(fecha = fechas.sumarDias(fechas.hoy(), 1)) {
  const fechaISO = fechas.aISO(fecha);
  if (!fechaISO) throw AppError.badRequest('La fecha no es válida.');

  const { nombreLaboratorio, plantilla, horaEnvio } = await obtenerAjustesDelMensaje();

  const citas = await citaModel.listarParaRecordatorio(fechaISO);
  const preparados = [];

  for (const cita of citas) {
    // Si ya se envió, no se regenera: el historial debe conservarse tal cual.
    if (cita.recordatorio_estado === 'ENVIADO') continue;

    preparados.push(
      await recordatorioModel.crearSiNoExiste({
        citaId: cita.id,
        telefono: cita.paciente_telefono,
        mensaje: generarMensaje(cita, nombreLaboratorio, plantilla),
        // El día anterior a la cita, a la hora que el laboratorio configuró.
        programadoPara: `${fechas.sumarDias(fechaISO, -1)} ${horaEnvio}:00`,
      }),
    );
  }

  return {
    fecha: fechaISO,
    citas_encontradas: citas.length,
    preparados: preparados.length,
    hora_envio: horaEnvio,
  };
}

/**
 * Envía un recordatorio concreto y registra el resultado.
 *
 * La imagen no se guarda con cada recordatorio: es la misma para todos y vive
 * en la configuración, así que se adjunta la que esté vigente en el momento del
 * envío. Quien ya llame en bucle puede pasarla para no releerla por cada uno.
 *
 * @param {object} recordatorio
 * @param {{imagen?: string}} [opciones]
 * @returns {Promise<object>} el recordatorio ya actualizado.
 */
async function enviar(recordatorio, { imagen } = {}) {
  const adjunto =
    imagen ?? (await configuracionService.obtener(configuracionService.CLAVES.IMAGEN_RECORDATORIO));

  const resultado = await whatsappClient.enviarMensaje({
    telefono: recordatorio.telefono,
    mensaje: recordatorio.mensaje,
    imagen: adjunto || undefined,
  });

  if (resultado.enviado) {
    await pacienteModel.registrarResultadoWhatsapp(recordatorio.paciente_id, true);
    return recordatorioModel.marcarEnviado(recordatorio.id);
  }

  if (MOTIVOS_SIN_WHATSAPP.has(resultado.motivo)) {
    // Queda constancia de que este paciente necesita otro medio de contacto.
    await pacienteModel.registrarResultadoWhatsapp(recordatorio.paciente_id, false);
  }

  return recordatorioModel.marcarFallido(
    recordatorio.id,
    `${resultado.motivo}: ${resultado.detalle ?? ''}`.trim(),
  );
}

/** Procesa todos los recordatorios pendientes cuya hora ya llegó. */
async function enviarPendientes() {
  const pendientes = await recordatorioModel.listarPendientes({
    hasta: `${fechas.hoy()} 23:59:59`,
  });

  const resumen = { total: pendientes.length, enviados: 0, fallidos: 0 };

  // La imagen es la misma para toda la tanda: se lee una vez.
  const imagen = await configuracionService.obtener(
    configuracionService.CLAVES.IMAGEN_RECORDATORIO,
  );

  for (const pendiente of pendientes) {
    const actualizado = await enviar(pendiente, { imagen });
    if (actualizado.estado === 'ENVIADO') resumen.enviados += 1;
    else resumen.fallidos += 1;
  }

  return resumen;
}

/**
 * Tarea completa que ejecuta el proceso programado: prepara los recordatorios
 * de las citas de mañana y los envía.
 */
async function procesarRecordatoriosDiarios() {
  const preparacion = await prepararParaFecha();
  const envio = await enviarPendientes();

  return { preparacion, envio };
}

/**
 * Rehace el recordatorio de una cita que acaba de moverse de fecha u hora.
 *
 * El aviso que ya salió quedó obsoleto —lleva el día viejo—, así que se vuelve a
 * dejar pendiente, se regenera el mensaje con los datos nuevos y se recoloca su
 * envío en la víspera de la fecha nueva. Sin esto, el proceso diario lo daría
 * por hecho y el paciente se quedaría con la cita anterior en el teléfono.
 *
 * No envía nada: solo deja el recordatorio listo para que salga cuando toque.
 *
 * @param {object} cita Cita ya actualizada.
 * @returns {Promise<object|null>} el recordatorio rehecho, o null si esa cita
 *   todavía no tenía ninguno (entonces se preparará por la vía normal).
 */
async function reprogramarParaCita(cita) {
  const existente = await recordatorioModel.buscarPorCita(cita.id);
  if (!existente) return null;

  const { nombreLaboratorio, plantilla, horaEnvio } = await obtenerAjustesDelMensaje();

  // Reabrir primero: `crearSiNoExiste` solo refresca lo que sigue pendiente.
  if (existente.estado !== 'PENDIENTE') {
    await recordatorioModel.reabrir(existente.id);
  }

  return recordatorioModel.crearSiNoExiste({
    citaId: cita.id,
    telefono: cita.paciente_telefono,
    mensaje: generarMensaje(cita, nombreLaboratorio, plantilla),
    programadoPara: `${fechas.sumarDias(cita.fecha, -1)} ${horaEnvio}:00`,
  });
}

/**
 * Envía ahora mismo el recordatorio de una cita concreta.
 *
 * Es la vía manual, para cuando el paciente llama a confirmar, se le agenda el
 * mismo día o el envío automático de esa noche falló: no espera a la hora
 * programada ni depende del proceso diario.
 *
 * Reenviar uno ya enviado está permitido a propósito —el personal a veces
 * necesita repetirlo—, pero cuenta como un intento más sobre el mismo registro.
 */
async function enviarParaCita(citaId) {
  const cita = await citaModel.buscarPorId(citaId);
  if (!cita) throw AppError.notFound('La cita no existe.');

  if (!['PENDIENTE', 'CONFIRMADA'].includes(cita.estado)) {
    throw AppError.badRequest(
      `La cita está ${cita.estado_nombre.toLowerCase()}: no tiene sentido recordarla.`,
    );
  }

  const { nombreLaboratorio, plantilla } = await obtenerAjustesDelMensaje();

  const existente = await recordatorioModel.buscarPorCita(cita.id);

  // El mensaje se regenera siempre: la cita pudo reprogramarse desde la última
  // vez, y `crearSiNoExiste` solo lo actualiza mientras sigue PENDIENTE.
  if (existente && existente.estado !== 'PENDIENTE') {
    await recordatorioModel.reabrir(existente.id);
  }

  const recordatorio = await recordatorioModel.crearSiNoExiste({
    citaId: cita.id,
    telefono: cita.paciente_telefono,
    mensaje: generarMensaje(cita, nombreLaboratorio, plantilla),
    programadoPara: `${fechas.hoy()} ${new Date().toTimeString().slice(0, 8)}`,
  });

  const enviado = await enviar({ ...recordatorio, paciente_id: cita.paciente_id });

  return {
    recordatorio: enviado,
    enviado: enviado.estado === 'ENVIADO',
    paciente: cita.paciente_nombre,
  };
}

/** Reintento manual de un recordatorio fallido. */
async function reintentar(id) {
  const recordatorio = await recordatorioModel.buscarPorId(id);
  if (!recordatorio) throw AppError.notFound('El recordatorio no existe.');

  if (recordatorio.estado === 'ENVIADO') {
    throw AppError.badRequest('El recordatorio ya fue enviado.');
  }

  return enviar(await recordatorioModel.reabrir(id));
}

// --- Mensaje que se envía ---------------------------------------------------

/**
 * Cómo está redactado hoy el recordatorio: el texto, la imagen adjunta y la
 * lista de datos que se pueden intercalar.
 */
async function obtenerPlantilla() {
  const [plantilla, imagen, nombreLaboratorio] = await Promise.all([
    configuracionService.obtener(configuracionService.CLAVES.PLANTILLA_RECORDATORIO),
    configuracionService.obtener(configuracionService.CLAVES.IMAGEN_RECORDATORIO),
    configuracionService.obtener(configuracionService.CLAVES.NOMBRE_LABORATORIO),
  ]);

  return {
    plantilla,
    imagen: imagen || null,
    marcadores: configuracionService.MARCADORES,
    por_defecto: configuracionService.PLANTILLA_POR_DEFECTO,
    ejemplo: generarMensaje(CITA_DE_EJEMPLO, nombreLaboratorio, plantilla),
  };
}

/**
 * Guarda el texto y la imagen del recordatorio.
 *
 * Solo se toca lo que venga en la petición: guardar el texto no borra la imagen
 * y viceversa. Para quitar la imagen hay que mandarla explícitamente vacía.
 */
async function guardarPlantilla({ plantilla, imagen }, idUsuario) {
  if (plantilla !== undefined) {
    await configuracionService.establecer(
      configuracionService.CLAVES.PLANTILLA_RECORDATORIO,
      plantilla,
      idUsuario,
    );
  }

  if (imagen !== undefined) {
    await configuracionService.establecer(
      configuracionService.CLAVES.IMAGEN_RECORDATORIO,
      imagen ?? '',
      idUsuario,
    );
  }

  return obtenerPlantilla();
}

/**
 * Muestra cómo quedaría un mensaje con la plantilla que se está escribiendo,
 * sin guardarla. Así el laboratorio ve el resultado antes de aplicarlo, y la
 * forma de rellenar los marcadores sigue viviendo en un solo sitio.
 */
async function previsualizarPlantilla(plantilla) {
  const nombreLaboratorio = await configuracionService.obtener(
    configuracionService.CLAVES.NOMBRE_LABORATORIO,
  );

  return {
    mensaje: generarMensaje(CITA_DE_EJEMPLO, nombreLaboratorio, plantilla),
    // El mismo ejemplo sin exámenes: enseña qué líneas desaparecen.
    mensaje_sin_examenes: generarMensaje(
      { ...CITA_DE_EJEMPLO, examenes: [] },
      nombreLaboratorio,
      plantilla,
    ),
  };
}

// ---------------------------------------------------------------------------

async function listar({ estado, desde, hasta } = {}) {
  return recordatorioModel.listar({ estado, desde, hasta });
}

async function obtenerResumen() {
  const [conteo, estadoWhatsapp] = await Promise.all([
    recordatorioModel.contarPorEstado(),
    whatsappClient.obtenerEstado(),
  ]);

  return { conteo, whatsapp: estadoWhatsapp };
}

module.exports = {
  generarMensaje,
  renderizarPlantilla,
  obtenerPlantilla,
  guardarPlantilla,
  previsualizarPlantilla,
  prepararParaFecha,
  enviar,
  enviarPendientes,
  enviarParaCita,
  reprogramarParaCita,
  procesarRecordatoriosDiarios,
  reintentar,
  listar,
  obtenerResumen,
};
