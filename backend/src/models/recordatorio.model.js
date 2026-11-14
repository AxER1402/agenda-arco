const { query, queryOne } = require('../config/database');

const CAMPOS = `
  r.id, r.cita_id, r.telefono, r.mensaje, r.estado, r.intentos, r.error_mensaje,
  r.programado_para, r.enviado_en, r.creado_en
`;

const DESDE = `
  FROM recordatorios r
  JOIN citas c ON c.id = r.cita_id
  JOIN pacientes p ON p.id = c.paciente_id
`;

const EXTRA = `
  c.fecha, c.hora, c.paciente_id,
  p.nombre_completo AS paciente_nombre, p.tiene_whatsapp AS paciente_tiene_whatsapp
`;

async function buscarPorId(id) {
  return queryOne(`SELECT ${CAMPOS}, ${EXTRA} ${DESDE} WHERE r.id = :id`, { id });
}

async function buscarPorCita(citaId) {
  return queryOne(`SELECT ${CAMPOS}, ${EXTRA} ${DESDE} WHERE r.cita_id = :citaId`, { citaId });
}

/**
 * Crea el recordatorio si la cita no tiene uno.
 * La restricción UNIQUE sobre cita_id evita duplicados aunque el proceso
 * programado se ejecute dos veces.
 *
 * Mientras siga PENDIENTE se refresca todo, incluida la hora de envío: si la
 * cita se movió de día, el aviso tiene que salir la víspera de la fecha nueva.
 * Lo ya enviado no se toca: el historial debe reflejar lo que se mandó.
 */
async function crearSiNoExiste({ citaId, telefono, mensaje, programadoPara }) {
  await query(
    `INSERT INTO recordatorios (cita_id, telefono, mensaje, programado_para)
     VALUES (:citaId, :telefono, :mensaje, :programadoPara)
     ON DUPLICATE KEY UPDATE
       mensaje = IF(estado = 'PENDIENTE', VALUES(mensaje), mensaje),
       telefono = IF(estado = 'PENDIENTE', VALUES(telefono), telefono),
       programado_para = IF(estado = 'PENDIENTE', VALUES(programado_para), programado_para)`,
    { citaId, telefono, mensaje, programadoPara },
  );

  return buscarPorCita(citaId);
}

async function marcarEnviado(id) {
  await query(
    `UPDATE recordatorios
        SET estado = 'ENVIADO', enviado_en = NOW(), intentos = intentos + 1, error_mensaje = NULL
      WHERE id = :id`,
    { id },
  );

  return buscarPorId(id);
}

async function marcarFallido(id, errorMensaje) {
  await query(
    `UPDATE recordatorios
        SET estado = 'FALLIDO', intentos = intentos + 1, error_mensaje = :errorMensaje
      WHERE id = :id`,
    { id, errorMensaje: String(errorMensaje ?? '').slice(0, 255) },
  );

  return buscarPorId(id);
}

/**
 * Recordatorios que toca enviar.
 *
 * Se comprueba el estado de la cita en el momento del envío, no solo el de
 * cuando se preparó: entre una cosa y otra la cita pudo cancelarse, y avisar a
 * alguien de una cita que ya no existe es peor que no avisar.
 */
async function listarPendientes({ hasta }) {
  return query(
    `SELECT ${CAMPOS}, ${EXTRA} ${DESDE}
       JOIN estados_cita ec ON ec.id = c.estado_id
      WHERE r.estado = 'PENDIENTE'
        AND r.programado_para <= :hasta
        AND ec.codigo IN ('PENDIENTE', 'CONFIRMADA')
        -- Quien dijo que no tiene WhatsApp no recibe nada, aunque su aviso se
        -- hubiera preparado antes de saberlo.
        AND COALESCE(p.tiene_whatsapp, 1) = 1
      ORDER BY r.programado_para`,
    { hasta },
  );
}

async function listar({ estado = null, desde = null, hasta = null } = {}) {
  return query(
    `SELECT ${CAMPOS}, ${EXTRA} ${DESDE}
      WHERE (:estado IS NULL OR r.estado = :estado)
        AND (:desde IS NULL OR c.fecha >= :desde)
        AND (:hasta IS NULL OR c.fecha <= :hasta)
      ORDER BY r.programado_para DESC
      LIMIT 200`,
    { estado, desde, hasta },
  );
}

/** Conteo por estado, para el panel principal. */
async function contarPorEstado() {
  const filas = await query(
    "SELECT estado, COUNT(*) AS total FROM recordatorios GROUP BY estado",
  );

  const conteo = { PENDIENTE: 0, ENVIADO: 0, FALLIDO: 0 };
  filas.forEach((fila) => {
    conteo[fila.estado] = Number(fila.total);
  });

  return conteo;
}

/** Vuelve a dejar un recordatorio fallido como pendiente. */
async function reabrir(id) {
  await query(
    "UPDATE recordatorios SET estado = 'PENDIENTE', error_mensaje = NULL WHERE id = :id",
    { id },
  );

  return buscarPorId(id);
}

/**
 * Quita el aviso todavía sin enviar de una cita.
 *
 * Solo lo PENDIENTE: lo enviado o fallido es historial y se conserva.
 */
async function descartarPendiente(citaId) {
  await query("DELETE FROM recordatorios WHERE cita_id = :citaId AND estado = 'PENDIENTE'", {
    citaId,
  });
}

/** Quita los avisos sin enviar de todas las citas de un paciente. */
async function descartarPendientesDePaciente(pacienteId) {
  await query(
    `DELETE r FROM recordatorios r
       JOIN citas c ON c.id = r.cita_id
      WHERE c.paciente_id = :pacienteId AND r.estado = 'PENDIENTE'`,
    { pacienteId },
  );
}

module.exports = {
  buscarPorId,
  buscarPorCita,
  crearSiNoExiste,
  marcarEnviado,
  marcarFallido,
  listarPendientes,
  listar,
  contarPorEstado,
  reabrir,
  descartarPendiente,
  descartarPendientesDePaciente,
};
