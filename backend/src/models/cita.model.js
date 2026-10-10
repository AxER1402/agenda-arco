/**
 * Acceso a datos de la agenda.
 */
const { query, queryOne, withTransaction } = require('../config/database');

const CAMPOS = `
  c.id, c.paciente_id, c.orden_id, c.estado_id, c.fecha, c.hora, c.notas,
  c.creado_por, c.creado_en, c.actualizado_en,
  p.nombre_completo AS paciente_nombre, p.telefono AS paciente_telefono,
  p.tiene_whatsapp AS paciente_tiene_whatsapp, p.dpi AS paciente_dpi,
  o.fecha_entrega, o.fecha_vencimiento, o.numero_orden, o.fecha_cita_igss,
  o.observaciones AS orden_observaciones,
  -- Quién la registró y cuándo. El CAST la saca como texto en la hora local,
  -- igual que los DATETIME, en lugar de como instante UTC.
  u.nombre_completo AS registrada_por, CAST(c.creado_en AS DATETIME) AS registrada_en,
  -- Último día en que se puede poner la cita: el vencimiento, o la víspera de
  -- la cita del IGSS si cae antes. Es la misma regla que
  -- ordenService.fechaLimiteCita; aquí sale ya calculada para cada fila.
  LEAST(o.fecha_vencimiento,
        COALESCE(o.fecha_cita_igss - INTERVAL 1 DAY, o.fecha_vencimiento)) AS fecha_limite,
  ec.codigo AS estado, ec.nombre AS estado_nombre, ec.es_final, ec.ocupa_cupo,
  r.id AS recordatorio_id, r.estado AS recordatorio_estado,
  r.enviado_en AS recordatorio_enviado_en, r.programado_para AS recordatorio_programado_para,
  r.error_mensaje AS recordatorio_error
`;

/**
 * El recordatorio entra con LEFT JOIN porque la mayoría de las citas todavía no
 * tienen uno; la clave única sobre `cita_id` garantiza que sea uno como mucho,
 * así que la unión no multiplica filas.
 */
const DESDE = `
  FROM citas c
  JOIN pacientes p ON p.id = c.paciente_id
  JOIN ordenes o ON o.id = c.orden_id
  JOIN estados_cita ec ON ec.id = c.estado_id
  LEFT JOIN recordatorios r ON r.cita_id = c.id
  LEFT JOIN usuarios u ON u.id = c.creado_por
`;

/** Adjunta los exámenes de cada cita en una sola consulta. */
async function adjuntarExamenes(citas) {
  if (citas.length === 0) return citas;

  const ids = citas.map((cita) => Number.parseInt(cita.id, 10)).filter(Number.isInteger);
  if (ids.length === 0) return citas;

  const filas = await query(
    `SELECT ce.cita_id, e.id, e.codigo, e.nombre, e.indicaciones,
            e.categoria_id, cat.nombre AS categoria_nombre,
            cat.indicaciones AS categoria_indicaciones
       FROM cita_examenes ce
       JOIN examenes e ON e.id = ce.examen_id
       LEFT JOIN categorias_examen cat ON cat.id = e.categoria_id
      WHERE ce.cita_id IN (${ids.join(',')})
      ORDER BY e.nombre`,
  );

  const porCita = new Map();
  filas.forEach(({ cita_id: citaId, ...examen }) => {
    if (!porCita.has(citaId)) porCita.set(citaId, []);
    porCita.get(citaId).push(examen);
  });

  return citas.map((cita) => ({ ...cita, examenes: porCita.get(cita.id) ?? [] }));
}

async function buscarPorId(id) {
  const cita = await queryOne(`SELECT ${CAMPOS} ${DESDE} WHERE c.id = :id`, { id });
  if (!cita) return null;

  const [conExamenes] = await adjuntarExamenes([cita]);
  return conExamenes;
}

/** Citas de un rango de fechas: es la base de las vistas día, semana y mes. */
async function listarPorRango({ desde, hasta, estado = null, incluirCanceladas = true }) {
  const citas = await query(
    `SELECT ${CAMPOS} ${DESDE}
      WHERE c.fecha BETWEEN :desde AND :hasta
        AND (:estado IS NULL OR ec.codigo = :estado)
        AND (:incluirCanceladas = 1 OR ec.codigo <> 'CANCELADA')
      ORDER BY c.fecha, c.hora, p.nombre_completo`,
    { desde, hasta, estado, incluirCanceladas: incluirCanceladas ? 1 : 0 },
  );

  return adjuntarExamenes(citas);
}

/** Historial completo de un paciente (requisito 12). */
async function listarPorPaciente(pacienteId) {
  const citas = await query(
    `SELECT ${CAMPOS} ${DESDE}
      WHERE c.paciente_id = :pacienteId
      ORDER BY c.fecha DESC, c.hora DESC`,
    { pacienteId },
  );

  return adjuntarExamenes(citas);
}

async function listarPorOrden(ordenId, { soloActivas = false } = {}) {
  return query(
    `SELECT ${CAMPOS} ${DESDE}
      WHERE c.orden_id = :ordenId
        AND (:soloActivas = 0 OR ec.codigo <> 'CANCELADA')
      ORDER BY c.fecha`,
    { ordenId, soloActivas: soloActivas ? 1 : 0 },
  );
}

/** Citas de un día concreto que ocupan cupo. Base del límite diario. */
async function contarOcupacion(fecha, conexion = null) {
  const sql = `SELECT COUNT(*) AS total
                 FROM citas c
                 JOIN estados_cita ec ON ec.id = c.estado_id
                WHERE c.fecha = :fecha AND ec.ocupa_cupo = 1`;

  if (conexion) {
    // Dentro de una transacción se bloquean las filas del día para que dos
    // usuarios no puedan tomar el último espacio a la vez.
    const [filas] = await conexion.execute(`${sql} FOR UPDATE`, { fecha });
    return Number(filas[0]?.total ?? 0);
  }

  const fila = await queryOne(sql, { fecha });
  return Number(fila?.total ?? 0);
}

/** Ocupación de cada día de un rango. Alimenta la sugerencia de fechas. */
async function contarOcupacionPorRango({ desde, hasta }) {
  const filas = await query(
    `SELECT c.fecha, COUNT(*) AS total
       FROM citas c
       JOIN estados_cita ec ON ec.id = c.estado_id
      WHERE c.fecha BETWEEN :desde AND :hasta AND ec.ocupa_cupo = 1
      GROUP BY c.fecha`,
    { desde, hasta },
  );

  return new Map(filas.map((fila) => [fila.fecha, Number(fila.total)]));
}

/** ¿El paciente ya tiene una cita activa ese día? */
async function existeCitaActiva({ pacienteId, fecha, excluirId = null }) {
  const fila = await queryOne(
    `SELECT c.id
       FROM citas c
       JOIN estados_cita ec ON ec.id = c.estado_id
      WHERE c.paciente_id = :pacienteId
        AND c.fecha = :fecha
        AND ec.codigo <> 'CANCELADA'
        AND (:excluirId IS NULL OR c.id <> :excluirId)
      LIMIT 1`,
    { pacienteId, fecha, excluirId },
  );

  return Boolean(fila);
}

/**
 * Crea la cita comprobando el cupo dentro de la misma transacción.
 * @param {(ocupacion: number) => void} verificarCupo Lanza si no hay espacio.
 */
async function crear(
  { pacienteId, ordenId, estadoId, fecha, hora, notas, examenes, creadoPor },
  verificarCupo,
) {
  const id = await withTransaction(async (conexion) => {
    const ocupacion = await contarOcupacion(fecha, conexion);
    verificarCupo(ocupacion);

    const [resultado] = await conexion.execute(
      `INSERT INTO citas (paciente_id, orden_id, estado_id, fecha, hora, notas, creado_por)
       VALUES (:pacienteId, :ordenId, :estadoId, :fecha, :hora, :notas, :creadoPor)`,
      { pacienteId, ordenId, estadoId, fecha, hora, notas, creadoPor },
    );

    for (const examenId of examenes) {
      await conexion.execute(
        'INSERT INTO cita_examenes (cita_id, examen_id) VALUES (:citaId, :examenId)',
        { citaId: resultado.insertId, examenId },
      );
    }

    return resultado.insertId;
  });

  return buscarPorId(id);
}

async function actualizar(id, { fecha, hora, estadoId, notas, examenes }, verificarCupo = null) {
  await withTransaction(async (conexion) => {
    if (fecha !== undefined && verificarCupo) {
      const ocupacion = await contarOcupacion(fecha, conexion);
      verificarCupo(ocupacion);
    }

    const asignaciones = [];
    const parametros = { id };

    if (fecha !== undefined) {
      asignaciones.push('fecha = :fecha');
      parametros.fecha = fecha;
    }
    if (hora !== undefined) {
      asignaciones.push('hora = :hora');
      parametros.hora = hora;
    }
    if (estadoId !== undefined) {
      asignaciones.push('estado_id = :estadoId');
      parametros.estadoId = estadoId;
    }
    if (notas !== undefined) {
      asignaciones.push('notas = :notas');
      parametros.notas = notas;
    }

    if (asignaciones.length > 0) {
      await conexion.execute(
        `UPDATE citas SET ${asignaciones.join(', ')} WHERE id = :id`,
        parametros,
      );
    }

    if (Array.isArray(examenes)) {
      await conexion.execute('DELETE FROM cita_examenes WHERE cita_id = :id', { id });
      for (const examenId of examenes) {
        await conexion.execute(
          'INSERT INTO cita_examenes (cita_id, examen_id) VALUES (:citaId, :examenId)',
          { citaId: id, examenId },
        );
      }
    }
  });

  return buscarPorId(id);
}

/**
 * Borrado definitivo de una cita.
 * Sus exámenes y su recordatorio desaparecen en cascada (ver el esquema).
 */
async function eliminar(id) {
  const resultado = await query('DELETE FROM citas WHERE id = :id', { id });
  return Number(resultado?.affectedRows ?? 0) > 0;
}

/** Citas de una fecha que deben recibir recordatorio (requisito 18). */
async function listarParaRecordatorio(fecha) {
  const citas = await query(
    `SELECT ${CAMPOS} ${DESDE}
      WHERE c.fecha = :fecha
        AND ec.codigo IN ('PENDIENTE', 'CONFIRMADA')
      ORDER BY c.hora`,
    { fecha },
  );

  return adjuntarExamenes(citas);
}

/**
 * Pasa a «No asistió» las citas anteriores a `fecha` que siguen pendientes o
 * confirmadas: si el día ya pasó y nadie las marcó como atendidas, el paciente
 * no vino. Devuelve cuántas cambió.
 */
async function marcarNoAsistidasAntesDe(fecha) {
  const resultado = await query(
    `UPDATE citas c
       JOIN estados_cita actual ON actual.id = c.estado_id
       JOIN estados_cita nuevo ON nuevo.codigo = 'NO_ASISTIO'
        SET c.estado_id = nuevo.id
      WHERE c.fecha < :fecha
        AND actual.codigo IN ('PENDIENTE', 'CONFIRMADA')`,
    { fecha },
  );

  return Number(resultado?.affectedRows ?? 0);
}

// --- Catálogo de estados ---------------------------------------------------

async function listarEstados() {
  return query(
    'SELECT id, codigo, nombre, es_final, ocupa_cupo FROM estados_cita ORDER BY id',
  );
}

async function buscarEstadoPorCodigo(codigo) {
  return queryOne(
    'SELECT id, codigo, nombre, es_final, ocupa_cupo FROM estados_cita WHERE codigo = :codigo',
    { codigo },
  );
}

module.exports = {
  buscarPorId,
  listarPorRango,
  listarPorPaciente,
  listarPorOrden,
  contarOcupacion,
  contarOcupacionPorRango,
  existeCitaActiva,
  crear,
  actualizar,
  eliminar,
  listarParaRecordatorio,
  marcarNoAsistidasAntesDe,
  listarEstados,
  buscarEstadoPorCodigo,
};
