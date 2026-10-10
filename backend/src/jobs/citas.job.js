/**
 * Proceso nocturno que cierra las citas de días pasados.
 *
 * Una cita cuyo día terminó sin marcarse como atendida pasa a «No asistió».
 * Corre poco después de medianoche y, además, al arrancar el backend: si el
 * servidor estuvo apagado esa noche, el cierre no se pierde.
 *
 * Si el paciente sí vino y solo faltó marcarlo, «No asistió» se puede corregir
 * a «Atendida» desde la agenda.
 */
const cron = require('node-cron');

const citaService = require('../services/cita.service');
const { ZONA_HORARIA } = require('../utils/fechas');

/** Todos los días a las 00:05. */
const EXPRESION = '5 0 * * *';

let tarea = null;

async function ejecutar() {
  try {
    const cerradas = await citaService.cerrarCitasPasadas();
    if (cerradas > 0) {
      console.log(`[citas] ${cerradas} cita(s) de días pasados marcadas como «No asistió»`);
    }
    return cerradas;
  } catch (error) {
    // Nunca debe tumbar el backend: se reintenta la noche siguiente o al arrancar.
    console.error('[citas] no se pudieron cerrar las citas pasadas:', error.message);
    return null;
  }
}

function iniciar() {
  if (tarea) tarea.stop();

  tarea = cron.schedule(EXPRESION, ejecutar, { timezone: ZONA_HORARIA });
  ejecutar();

  return tarea;
}

function detener() {
  if (tarea) {
    tarea.stop();
    tarea = null;
  }
}

module.exports = { iniciar, detener, ejecutar, EXPRESION };
