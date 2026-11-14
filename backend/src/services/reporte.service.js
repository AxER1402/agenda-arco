/**
 * Construcción de los reportes del sistema.
 *
 * Aquí no se sabe nada de PDF ni de Word. Cada reporte se arma como un
 * **documento neutro** —título, indicadores y tablas— y son los dos
 * generadores de `src/reportes/` los que lo pintan. Así la decisión de qué
 * columnas lleva un reporte se toma una sola vez y no dos veces mal, y las
 * pruebas comprueban el contenido sin tener que abrir un binario.
 */
const citaModel = require('../models/cita.model');
const configuracionService = require('./configuracion.service');
const disponibilidadService = require('./disponibilidad.service');
const AppError = require('../utils/AppError');
const fechas = require('../utils/fechas');

/** Un rango más largo que esto no cabe en una hoja con sentido. */
const MAXIMO_DIAS = 366;

const ESTADOS_TEXTO = {
  PENDIENTE: 'Pendiente',
  CONFIRMADA: 'Confirmada',
  ATENDIDA: 'Atendida',
  NO_ASISTIO: 'No asistió',
  CANCELADA: 'Cancelada',
};

const RECORDATORIOS_TEXTO = {
  ENVIADO: 'Enviado',
  FALLIDO: 'Falló',
  PENDIENTE: 'En cola',
};

function validarRango(desde, hasta) {
  const inicio = fechas.aISO(desde);
  const fin = fechas.aISO(hasta);

  if (!inicio || !fin) {
    throw AppError.badRequest('Las fechas del reporte deben tener el formato AAAA-MM-DD.');
  }

  if (fechas.comparar(inicio, fin) > 0) {
    throw AppError.badRequest('La fecha inicial no puede ser posterior a la final.');
  }

  if (fechas.diferenciaEnDias(inicio, fin) + 1 > MAXIMO_DIAS) {
    throw AppError.badRequest(`El reporte no puede abarcar más de ${MAXIMO_DIAS} días.`);
  }

  return { inicio, fin };
}

/** Cabecera común: de quién es el reporte, de qué periodo y quién lo sacó. */
async function encabezado({ titulo, inicio, fin, usuario }) {
  const configuracion = await configuracionService.obtenerTodas();

  return {
    laboratorio: configuracion[configuracionService.CLAVES.NOMBRE_LABORATORIO],
    titulo,
    periodo:
      inicio === fin
        ? fechas.aFormatoLocal(inicio)
        : `Del ${fechas.aFormatoLocal(inicio)} al ${fechas.aFormatoLocal(fin)}`,
    generado: {
      fecha: fechas.aFormatoLocal(fechas.hoy()),
      usuario: usuario?.nombre_completo ?? usuario?.usuario ?? '',
    },
  };
}

/** Los exámenes de una cita, en una sola celda. */
function examenesEnTexto(cita) {
  const nombres = (cita.examenes ?? []).map((examen) => examen.nombre);
  return nombres.length > 0 ? nombres.join(', ') : '—';
}

/**
 * Listado de citas del periodo: la hoja de trabajo que se imprime y se lleva
 * al mostrador. Va ordenada por fecha y hora, que es como se atiende.
 */
async function listadoDeCitas({ desde, hasta, estado = null, usuario = null } = {}) {
  const { inicio, fin } = validarRango(desde, hasta);

  const citas = await citaModel.listarPorRango({
    desde: inicio,
    hasta: fin,
    estado,
    incluirCanceladas: true,
  });

  const pacientes = new Set(citas.map((cita) => cita.paciente_id));
  const dias = new Set(citas.map((cita) => cita.fecha));

  const secciones = [
    {
      tipo: 'indicadores',
      datos: [
        { etiqueta: 'Citas', valor: String(citas.length) },
        { etiqueta: 'Pacientes', valor: String(pacientes.size) },
        { etiqueta: 'Días con citas', valor: String(dias.size) },
      ],
    },
    {
      tipo: 'tabla',
      columnas: [
        { clave: 'fecha', titulo: 'Fecha', ancho: 9 },
        { clave: 'hora', titulo: 'Hora', ancho: 8 },
        { clave: 'paciente', titulo: 'Paciente', ancho: 24 },
        { clave: 'telefono', titulo: 'Teléfono', ancho: 10 },
        { clave: 'examenes', titulo: 'Exámenes', ancho: 33 },
        { clave: 'estado', titulo: 'Estado', ancho: 16 },
      ],
      filas: citas.map((cita) => ({
        fecha: fechas.aFormatoLocal(cita.fecha),
        hora: fechas.horaAFormatoLocal(String(cita.hora)),
        paciente: cita.paciente_nombre,
        telefono: cita.paciente_telefono,
        examenes: examenesEnTexto(cita),
        estado: ESTADOS_TEXTO[cita.estado] ?? cita.estado,
      })),
      vacia: 'No hay ninguna cita en el periodo.',
    },
  ];

  if (estado) {
    secciones.push({
      tipo: 'nota',
      texto: `Filtrado por estado: ${ESTADOS_TEXTO[estado] ?? estado}.`,
    });
  }

  return {
    ...(await encabezado({ titulo: 'Listado de citas', inicio, fin, usuario })),
    archivo: `citas-${inicio}-a-${fin}`,
    // Seis columnas, y una de ellas con la lista de exámenes: en vertical la
    // tabla se estrangula y los nombres se parten en tres líneas.
    orientacion: 'horizontal',
    secciones,
  };
}

/** Reparte las citas por una clave y ordena de más a menos. */
function contarPor(citas, obtenerClave) {
  const cuenta = new Map();

  citas.forEach((cita) => {
    [obtenerClave(cita)].flat().forEach((clave) => {
      if (clave === null || clave === undefined) return;
      cuenta.set(clave, (cuenta.get(clave) ?? 0) + 1);
    });
  });

  return [...cuenta.entries()].sort((uno, otro) => otro[1] - uno[1]);
}

function porcentaje(parte, total) {
  return total === 0 ? '0 %' : `${Math.round((parte * 100) / total)} %`;
}

/**
 * Resumen de actividad del periodo: los números que se enseñan, no la lista.
 *
 * La ocupación se mide contra los días laborables que hubo de verdad en el
 * rango, no contra los días naturales: en un mes con el domingo cerrado, dividir
 * entre 30 daría una ocupación falsamente baja.
 */
async function resumenDeActividad({ desde, hasta, usuario = null } = {}) {
  const { inicio, fin } = validarRango(desde, hasta);

  const [citas, parametros] = await Promise.all([
    citaModel.listarPorRango({ desde: inicio, hasta: fin, incluirCanceladas: true }),
    disponibilidadService.obtenerParametros(),
  ]);

  let laborables = 0;
  for (let f = inicio; fechas.comparar(f, fin) <= 0; f = fechas.sumarDias(f, 1)) {
    if (disponibilidadService.esDiaLaborable(f, parametros.diasLaborables, parametros.feriados)) laborables += 1;
  }

  const total = citas.length;
  const ocupanCupo = citas.filter((cita) => cita.ocupa_cupo).length;
  const atendidas = citas.filter((cita) => cita.estado === 'ATENDIDA').length;
  const noAsistio = citas.filter((cita) => cita.estado === 'NO_ASISTIO').length;

  // La asistencia solo se puede medir sobre lo que ya pasó por el mostrador:
  // una cita todavía pendiente no es ni una ausencia ni una atención.
  const cerradas = atendidas + noAsistio;
  const capacidad = laborables * parametros.limiteDiario;

  const porEstado = contarPor(citas, (cita) => cita.estado);
  const porExamen = contarPor(citas, (cita) => (cita.examenes ?? []).map((e) => e.nombre));
  const porRecordatorio = contarPor(citas, (cita) => cita.recordatorio_estado ?? 'SIN_RECORDATORIO');

  return {
    ...(await encabezado({ titulo: 'Resumen de actividad', inicio, fin, usuario })),
    archivo: `actividad-${inicio}-a-${fin}`,
    orientacion: 'vertical',
    secciones: [
      {
        tipo: 'indicadores',
        datos: [
          { etiqueta: 'Citas', valor: String(total) },
          { etiqueta: 'Atendidas', valor: String(atendidas) },
          { etiqueta: 'No asistió', valor: String(noAsistio) },
          {
            etiqueta: 'Asistencia',
            valor: porcentaje(atendidas, cerradas),
            detalle: cerradas === 0 ? 'Sin citas cerradas' : `Sobre ${cerradas} cerradas`,
          },
          {
            etiqueta: 'Ocupación',
            valor: porcentaje(ocupanCupo, capacidad),
            detalle: `${ocupanCupo} de ${capacidad} espacios`,
          },
        ],
      },
      {
        tipo: 'tabla',
        titulo: 'Cómo terminaron las citas',
        columnas: [
          { clave: 'estado', titulo: 'Estado', ancho: 60 },
          { clave: 'citas', titulo: 'Citas', ancho: 20, alineacion: 'derecha' },
          { clave: 'parte', titulo: 'Parte', ancho: 20, alineacion: 'derecha' },
        ],
        filas: porEstado.map(([estado, cuantas]) => ({
          estado: ESTADOS_TEXTO[estado] ?? estado,
          citas: String(cuantas),
          parte: porcentaje(cuantas, total),
        })),
        vacia: 'No hubo citas en el periodo.',
      },
      {
        tipo: 'tabla',
        titulo: 'Exámenes más pedidos',
        columnas: [
          { clave: 'examen', titulo: 'Examen', ancho: 80 },
          { clave: 'veces', titulo: 'Veces', ancho: 20, alineacion: 'derecha' },
        ],
        filas: porExamen.slice(0, 15).map(([examen, veces]) => ({
          examen,
          veces: String(veces),
        })),
        vacia: 'No se asignó ningún examen en el periodo.',
      },
      {
        tipo: 'tabla',
        titulo: 'Recordatorios de WhatsApp',
        columnas: [
          { clave: 'estado', titulo: 'Estado', ancho: 60 },
          { clave: 'citas', titulo: 'Citas', ancho: 20, alineacion: 'derecha' },
          { clave: 'parte', titulo: 'Parte', ancho: 20, alineacion: 'derecha' },
        ],
        filas: porRecordatorio.map(([estado, cuantas]) => ({
          estado: RECORDATORIOS_TEXTO[estado] ?? 'Sin recordatorio',
          citas: String(cuantas),
          parte: porcentaje(cuantas, total),
        })),
        vacia: 'No hubo citas en el periodo.',
      },
      {
        tipo: 'nota',
        texto:
          `El periodo tuvo ${laborables} día(s) de atención, con un límite de ` +
          `${parametros.limiteDiario} pacientes por día.`,
      },
    ],
  };
}

module.exports = {
  MAXIMO_DIAS,
  ESTADOS_TEXTO,
  validarRango,
  listadoDeCitas,
  resumenDeActividad,
};
