/**
 * Proceso programado que envía los recordatorios del día siguiente.
 *
 * Se usa node-cron dentro del propio backend en lugar de una cola externa
 * (Redis, RabbitMQ): el volumen es de 25 a 40 mensajes diarios y añadir otra
 * pieza de infraestructura complicaría el despliegue sin aportar nada.
 *
 * La hora la decide el laboratorio desde Configuración, no una variable de
 * entorno: cambiarla no debería exigir tocar el despliegue ni reiniciar nada.
 * Al guardarla, `reprogramar()` vuelve a montar la tarea con la hora nueva.
 */
const cron = require('node-cron');

const recordatorioService = require('../services/recordatorio.service');
const configuracionService = require('../services/configuracion.service');
const { ZONA_HORARIA } = require('../utils/fechas');

let tarea = null;
let expresionActual = null;

/** 'HH:MM' → expresión cron diaria ('08:30' → '30 8 * * *'). */
function aExpresionCron(hora) {
  const [horas, minutos] = String(hora).split(':');
  return `${Number(minutos)} ${Number(horas)} * * *`;
}

async function horaConfigurada() {
  return configuracionService.obtener(configuracionService.CLAVES.HORA_RECORDATORIOS);
}

async function ejecutar() {
  console.log('[recordatorios] iniciando proceso diario');

  try {
    const resultado = await recordatorioService.procesarRecordatoriosDiarios();

    console.log(
      `[recordatorios] preparados: ${resultado.preparacion.preparados}, ` +
        `enviados: ${resultado.envio.enviados}, fallidos: ${resultado.envio.fallidos}`,
    );

    return resultado;
  } catch (error) {
    // Un fallo aquí nunca debe tumbar el backend: los recordatorios se pueden
    // reintentar a mano desde la interfaz.
    console.error('[recordatorios] el proceso diario falló:', error.message);
    return null;
  }
}

/**
 * Monta la tarea con la hora configurada.
 * Si la base todavía no responde se usa la hora por defecto: el backend tiene
 * que arrancar igual, y `reprogramar()` corregirá la hora en cuanto se guarde.
 */
async function iniciar() {
  let hora;

  try {
    hora = await horaConfigurada();
  } catch (error) {
    hora = '08:00';
    console.error(
      `[recordatorios] no se pudo leer la hora configurada (${error.message}); se usa ${hora}`,
    );
  }

  const expresion = aExpresionCron(hora);

  if (!cron.validate(expresion)) {
    console.error(`[recordatorios] expresión cron inválida: "${expresion}"`);
    return null;
  }

  if (tarea) tarea.stop();

  tarea = cron.schedule(expresion, ejecutar, { timezone: ZONA_HORARIA });
  expresionActual = expresion;

  console.log(`[recordatorios] programado todos los días a las ${hora} (${ZONA_HORARIA})`);

  return tarea;
}

/**
 * Vuelve a leer la hora y remonta la tarea. Lo llama la configuración cuando el
 * administrador la cambia, para que surta efecto sin reiniciar el backend.
 */
async function reprogramar() {
  return iniciar();
}

function detener() {
  if (tarea) {
    tarea.stop();
    tarea = null;
    expresionActual = null;
  }
}

module.exports = {
  iniciar,
  reprogramar,
  detener,
  ejecutar,
  aExpresionCron,
  expresionActual: () => expresionActual,
};
