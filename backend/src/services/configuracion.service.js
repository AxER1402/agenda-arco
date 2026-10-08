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
  HORA_CITA_PREDETERMINADA: 'hora_cita_predeterminada',
  DIAS_FERIADOS: 'dias_feriados',
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
  indicaciones:
    'Indicaciones de los exámenes de la cita (p. ej. orina o heces). Si el mensaje no lo usa, ' +
    'se agregan al final.',
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
  '{indicaciones}',
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

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const LONGITUD_MAXIMA_FERIADO = 80;
const MAXIMO_FERIADOS = 300;

/** ¿Es un día que existe en el calendario? (descarta el 31 de febrero). */
function esFechaReal(iso) {
  if (!FECHA_ISO.test(iso)) return false;
  const fecha = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === iso;
}

/**
 * Feriados como lista de `{ fecha, descripcion, anual }`.
 *
 * En la base van como JSON; desde la pantalla llegan ya como lista. Un valor
 * ilegible se devuelve como `null` para que la validación lo rechace en vez de
 * dejar pasar una lista vacía que borraría los feriados sin avisar.
 */
function convertirFeriados(valor) {
  let lista = valor;

  if (typeof valor === 'string') {
    if (valor.trim() === '') return [];
    try {
      lista = JSON.parse(valor);
    } catch {
      return null;
    }
  }

  if (!Array.isArray(lista)) return null;

  return lista
    .map((feriado) => ({
      fecha: String(feriado?.fecha ?? '').slice(0, 10),
      descripcion: String(feriado?.descripcion ?? '').trim(),
      anual: feriado?.anual === true || feriado?.anual === 'true' || feriado?.anual === 1,
    }))
    .sort((uno, otro) => uno.fecha.localeCompare(otro.fecha));
}

/** Dos feriados chocan si caen el mismo día; el anual, en cualquier año. */
function chocan(uno, otro) {
  return uno.anual || otro.anual
    ? uno.fecha.slice(5) === otro.fecha.slice(5)
    : uno.fecha === otro.fecha;
}

function problemaConFeriados(lista) {
  if (!Array.isArray(lista)) return 'Los feriados no tienen un formato válido.';
  if (lista.length > MAXIMO_FERIADOS) return `No se pueden registrar más de ${MAXIMO_FERIADOS} feriados.`;

  const invalido = lista.find((feriado) => !esFechaReal(feriado.fecha));
  if (invalido) return `La fecha del feriado «${invalido.descripcion || invalido.fecha}» no es válida.`;

  const largo = lista.find((feriado) => feriado.descripcion.length > LONGITUD_MAXIMA_FERIADO);
  if (largo) return `La descripción de un feriado no puede exceder ${LONGITUD_MAXIMA_FERIADO} caracteres.`;

  const repetido = lista.find((feriado, indice) =>
    lista.slice(0, indice).some((anterior) => chocan(anterior, feriado)),
  );
  if (repetido) {
    return `El ${repetido.fecha.split('-').reverse().join('/')} ya está registrado como feriado.`;
  }

  return null;
}

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
    // Los siete días. El laboratorio quita en Configuración los que no atienda:
    // es preferible que un día abierto se cierre a mano a que un sábado o un
    // domingo de trabajo no se pueda agendar.
    porDefecto: [1, 2, 3, 4, 5, 6, 7],
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
  [CLAVES.HORA_CITA_PREDETERMINADA]: {
    // La de apertura: casi todas las citas se dan a primera hora.
    porDefecto: '07:00',
    convertir: (valor) => String(valor).slice(0, 5),
    valido: (valor) => HORA.test(valor),
    mensaje: 'La hora predeterminada de las citas debe tener el formato HH:MM.',
  },
  [CLAVES.DIAS_FERIADOS]: {
    // Fechas en que el laboratorio cierra aunque el día de la semana sea de
    // atención. Con `anual`, se repite cada año en el mismo día y mes.
    porDefecto: [],
    convertir: convertirFeriados,
    valido: (valor) => problemaConFeriados(valor) === null,
    mensaje: (valor) => problemaConFeriados(valor),
    serializar: (valor) => JSON.stringify(valor),
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

/**
 * El feriado que cae en esa fecha, o `null`.
 * Los anuales coinciden por día y mes, sea cual sea el año.
 */
function feriadoEn(fechaISO, feriados = []) {
  return (
    feriados.find((feriado) =>
      feriado.anual ? feriado.fecha.slice(5) === fechaISO.slice(5) : feriado.fecha === fechaISO,
    ) ?? null
  );
}

module.exports = {
  CLAVES,
  feriadoEn,
  MARCADORES,
  PLANTILLA_POR_DEFECTO,
  marcadoresDe,
  obtener,
  obtenerTodas,
  establecer,
  establecerVarias,
};
