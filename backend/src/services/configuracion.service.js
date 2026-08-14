/**
 * Lectura y escritura de la configuración del laboratorio.
 *
 * Cada parámetro declara su tipo, su valor por defecto y cómo validarlo, de
 * modo que un valor corrupto en la base nunca tumbe la agenda.
 */
const configuracionModel = require('../models/configuracion.model');
const AppError = require('../utils/AppError');

const CLAVES = {
  LIMITE_DIARIO: 'limite_diario_pacientes',
  VIGENCIA_MESES: 'vigencia_orden_meses',
  DIAS_LABORABLES: 'dias_laborables',
  HORA_APERTURA: 'hora_apertura',
  HORA_CIERRE: 'hora_cierre',
  INTERVALO_MINUTOS: 'intervalo_citas_minutos',
  HORA_RECORDATORIOS: 'hora_recordatorios',
  NOMBRE_LABORATORIO: 'nombre_laboratorio',
  PLANTILLA_RECORDATORIO: 'plantilla_recordatorio',
  IMAGEN_RECORDATORIO: 'imagen_recordatorio',
};

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Datos que la plantilla del recordatorio puede insertar entre llaves.
 * Se declaran aquí para que la validación, el envío y la interfaz hablen todos
 * de la misma lista.
 */
const MARCADORES = {
  paciente: 'Nombre del paciente.',
  laboratorio: 'Nombre del laboratorio.',
  fecha: 'Fecha de la cita (DD/MM/AAAA).',
  hora: 'Hora de la cita (HH:MM AM/PM).',
  examenes: 'Exámenes de la cita, separados por comas.',
  etiqueta_examenes: '«Examen» o «Exámenes», según cuántos haya.',
};

/** Texto que se envía mientras el laboratorio no escriba el suyo. */
const PLANTILLA_POR_DEFECTO = [
  'Estimado(a) {paciente}:',
  '',
  'Le recordamos que tiene una cita programada en {laboratorio}.',
  '',
  'Fecha: {fecha}',
  'Hora: {hora}',
  '{etiqueta_examenes}: {examenes}',
  '',
  'Agradecemos su puntualidad.',
].join('\n');

const LONGITUD_MAXIMA_PLANTILLA = 1500;

/**
 * Tamaño máximo del data URI de la imagen (≈1,1 MB de imagen real).
 * WhatsApp admite bastante más, pero la imagen viaja en cada envío y se guarda
 * en la base: un banner del laboratorio cabe de sobra en este margen.
 */
const LONGITUD_MAXIMA_IMAGEN = 1_500_000;

/** Formatos que WhatsApp muestra sin convertir. */
const IMAGEN_DATA_URI = /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

/** Marcadores usados en un texto, en orden de aparición y sin repetir. */
function marcadoresDe(texto) {
  const encontrados = String(texto).match(/\{\s*[^{}]*\s*\}/g) ?? [];
  return [...new Set(encontrados.map((marcador) => marcador.slice(1, -1).trim()))];
}

const DEFINICIONES = {
  [CLAVES.LIMITE_DIARIO]: {
    porDefecto: 40,
    convertir: (valor) => Number.parseInt(valor, 10),
    valido: (valor) => Number.isInteger(valor) && valor >= 1 && valor <= 500,
    mensaje: 'El límite diario debe ser un número entero entre 1 y 500.',
  },
  [CLAVES.VIGENCIA_MESES]: {
    porDefecto: 3,
    convertir: (valor) => Number.parseInt(valor, 10),
    valido: (valor) => Number.isInteger(valor) && valor >= 1 && valor <= 24,
    mensaje: 'La vigencia debe ser un número entero de meses entre 1 y 24.',
  },
  [CLAVES.DIAS_LABORABLES]: {
    porDefecto: [1, 2, 3, 4, 5, 6],
    convertir: (valor) =>
      String(valor)
        .split(',')
        .map((dia) => Number.parseInt(dia.trim(), 10))
        .filter((dia) => Number.isInteger(dia)),
    valido: (valor) =>
      Array.isArray(valor) && valor.length > 0 && valor.every((dia) => dia >= 1 && dia <= 7),
    mensaje: 'Los días laborables deben indicarse como números del 1 (lunes) al 7 (domingo).',
    serializar: (valor) => (Array.isArray(valor) ? valor.join(',') : String(valor)),
  },
  [CLAVES.HORA_APERTURA]: {
    porDefecto: '07:00',
    convertir: (valor) => String(valor).slice(0, 5),
    valido: (valor) => HORA.test(valor),
    mensaje: 'La hora de apertura debe tener el formato HH:MM.',
  },
  [CLAVES.HORA_CIERRE]: {
    porDefecto: '17:00',
    convertir: (valor) => String(valor).slice(0, 5),
    valido: (valor) => HORA.test(valor),
    mensaje: 'La hora de cierre debe tener el formato HH:MM.',
  },
  [CLAVES.INTERVALO_MINUTOS]: {
    porDefecto: 15,
    convertir: (valor) => Number.parseInt(valor, 10),
    valido: (valor) => Number.isInteger(valor) && valor >= 5 && valor <= 120,
    mensaje: 'El intervalo entre citas debe estar entre 5 y 120 minutos.',
  },
  [CLAVES.HORA_RECORDATORIOS]: {
    porDefecto: '08:00',
    convertir: (valor) => String(valor).slice(0, 5),
    valido: (valor) => HORA.test(valor),
    mensaje: 'La hora de los recordatorios debe tener el formato HH:MM.',
  },
  [CLAVES.NOMBRE_LABORATORIO]: {
    porDefecto: 'El Arco Laboratorios',
    convertir: (valor) => String(valor).trim(),
    valido: (valor) => valor.length > 0 && valor.length <= 120,
    mensaje: 'El nombre del laboratorio no puede estar vacío.',
  },
  [CLAVES.PLANTILLA_RECORDATORIO]: {
    porDefecto: PLANTILLA_POR_DEFECTO,
    // Se conservan los saltos de línea; solo se recortan los extremos.
    convertir: (valor) => String(valor).replace(/\r\n/g, '\n').trim(),
    valido: (valor) =>
      valor.length > 0 &&
      valor.length <= LONGITUD_MAXIMA_PLANTILLA &&
      marcadoresDe(valor).every((marcador) => marcador in MARCADORES),
    mensaje: (valor) => {
      if (!valor || valor.length === 0) return 'El mensaje del recordatorio no puede estar vacío.';

      if (valor.length > LONGITUD_MAXIMA_PLANTILLA) {
        return `El mensaje no puede exceder ${LONGITUD_MAXIMA_PLANTILLA} caracteres.`;
      }

      const desconocidos = marcadoresDe(valor).filter((marcador) => !(marcador in MARCADORES));

      return (
        `El mensaje usa datos que no existen: ${desconocidos.map((m) => `{${m}}`).join(', ')}. ` +
        `Los disponibles son: ${Object.keys(MARCADORES).map((m) => `{${m}}`).join(', ')}.`
      );
    },
    // No viaja con el resto de la configuración: solo lo pide la pantalla que
    // lo edita y el proceso que arma los mensajes.
    interna: true,
  },
  [CLAVES.IMAGEN_RECORDATORIO]: {
    porDefecto: '',
    convertir: (valor) => String(valor ?? '').trim(),
    // La cadena vacía es válida a propósito: significa «sin imagen».
    valido: (valor) =>
      valor.length === 0 ||
      (valor.length <= LONGITUD_MAXIMA_IMAGEN && IMAGEN_DATA_URI.test(valor)),
    mensaje: (valor) =>
      valor.length > LONGITUD_MAXIMA_IMAGEN
        ? 'La imagen pesa demasiado. Use una de menos de 1 MB.'
        : 'La imagen debe ser un archivo PNG, JPG o WEBP.',
    // Pesa demasiado para incluirla en cada lectura de la configuración.
    interna: true,
  },
};

/**
 * Lee un parámetro ya convertido a su tipo.
 * Si falta o está corrupto se devuelve el valor por defecto: la agenda debe
 * seguir funcionando aunque alguien haya tocado la tabla a mano.
 */
async function obtener(clave) {
  const definicion = DEFINICIONES[clave];
  if (!definicion) throw AppError.badRequest(`El parámetro "${clave}" no existe.`);

  const fila = await configuracionModel.obtener(clave);
  if (!fila) return definicion.porDefecto;

  const convertido = definicion.convertir(fila.valor);
  return definicion.valido(convertido) ? convertido : definicion.porDefecto;
}

/**
 * Configuración general de la agenda.
 * Deja fuera los parámetros marcados como internos —el mensaje del recordatorio
 * y su imagen—, que tienen su propia pantalla y pesan demasiado para acompañar
 * a cada lectura del horario o del límite diario.
 */
async function obtenerTodas() {
  const claves = Object.values(CLAVES).filter((clave) => !DEFINICIONES[clave].interna);
  const valores = await Promise.all(claves.map((clave) => obtener(clave)));

  return Object.fromEntries(claves.map((clave, indice) => [clave, valores[indice]]));
}

/** Solo el administrador llega aquí (lo garantiza el middleware de la ruta). */
async function establecer(clave, valorCrudo, idUsuario) {
  const definicion = DEFINICIONES[clave];
  if (!definicion) throw AppError.badRequest(`El parámetro "${clave}" no existe.`);

  const convertido = definicion.convertir(valorCrudo);

  if (!definicion.valido(convertido)) {
    throw AppError.badRequest(
      typeof definicion.mensaje === 'function' ? definicion.mensaje(convertido) : definicion.mensaje,
    );
  }

  const serializado = definicion.serializar
    ? definicion.serializar(convertido)
    : String(convertido);

  await configuracionModel.establecer(clave, serializado, idUsuario);

  return { clave, valor: convertido };
}

/** Aplica varios parámetros en una sola operación. */
async function establecerVarias(cambios, idUsuario) {
  const claves = Object.keys(cambios);

  const desconocida = claves.find((clave) => !DEFINICIONES[clave]);
  if (desconocida) throw AppError.badRequest(`El parámetro "${desconocida}" no existe.`);

  const resultados = [];
  for (const clave of claves) {
    resultados.push(await establecer(clave, cambios[clave], idUsuario));
  }

  // La coherencia entre apertura y cierre se comprueba con el estado final.
  const configuracion = await obtenerTodas();
  if (configuracion[CLAVES.HORA_APERTURA] >= configuracion[CLAVES.HORA_CIERRE]) {
    throw AppError.badRequest('La hora de apertura debe ser anterior a la hora de cierre.');
  }

  return configuracion;
}

module.exports = {
  CLAVES,
  MARCADORES,
  PLANTILLA_POR_DEFECTO,
  marcadoresDe,
  obtener,
  obtenerTodas,
  establecer,
  establecerVarias,
};
