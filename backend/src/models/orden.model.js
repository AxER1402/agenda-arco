/**
 * Acceso a datos de las órdenes del IGSS y sus exámenes.
 */
const { query, queryOne, withTransaction } = require('../config/database');

const CAMPOS = `
  o.id, o.paciente_id, o.numero_orden, o.fecha_entrega, o.fecha_vencimiento, o.fecha_cita_igss,
  o.observaciones, o.creado_por, o.creado_en
`;

/** Agrega los exámenes de cada orden en una sola consulta adicional. */
async function adjuntarExamenes(ordenes) {
  if (ordenes.length === 0) return ordenes;

  const ids = ordenes.map((orden) => Number.parseInt(orden.id, 10)).filter(Number.isInteger);
  if (ids.length === 0) return ordenes;

  const filas = await query(
    `SELECT oe.orden_id, e.id, e.codigo, e.nombre
       FROM orden_examenes oe
       JOIN examenes e ON e.id = oe.examen_id
      WHERE oe.orden_id IN (${ids.join(',')})
      ORDER BY e.nombre`,
  );

  const porOrden = new Map();
  filas.forEach(({ orden_id: ordenId, ...examen }) => {
    if (!porOrden.has(ordenId)) porOrden.set(ordenId, []);
    porOrden.get(ordenId).push(examen);
  });

  return ordenes.map((orden) => ({ ...orden, examenes: porOrden.get(orden.id) ?? [] }));
}

async function buscarPorId(id) {
  const orden = await queryOne(
    `SELECT ${CAMPOS}, p.nombre_completo AS paciente_nombre, p.telefono AS paciente_telefono
       FROM ordenes o
       JOIN pacientes p ON p.id = o.paciente_id
      WHERE o.id = :id`,
    { id },
  );

  if (!orden) return null;

  const [conExamenes] = await adjuntarExamenes([orden]);
  return conExamenes;
}

async function listarPorPaciente(pacienteId) {
  const ordenes = await query(
    `SELECT ${CAMPOS}
       FROM ordenes o
      WHERE o.paciente_id = :pacienteId
      ORDER BY o.fecha_entrega DESC, o.id DESC`,
    { pacienteId },
  );

  return adjuntarExamenes(ordenes);
}

/**
 * Órdenes vigentes que todavía no tienen una cita activa.
 * Son las que el personal necesita ver para no dejar vencer una orden.
 */
async function listarPorVencer({ desde, hasta }) {
  const ordenes = await query(
    `SELECT ${CAMPOS}, p.nombre_completo AS paciente_nombre, p.telefono AS paciente_telefono,
            (SELECT COUNT(*)
               FROM citas c
               JOIN estados_cita ec ON ec.id = c.estado_id
              WHERE c.orden_id = o.id AND ec.codigo <> 'CANCELADA') AS citas_activas
       FROM ordenes o
       JOIN pacientes p ON p.id = o.paciente_id
      WHERE o.fecha_vencimiento BETWEEN :desde AND :hasta
      HAVING citas_activas = 0
      ORDER BY o.fecha_vencimiento`,
    { desde, hasta },
  );

  return adjuntarExamenes(ordenes);
}

/**
 * Crea la orden y su relación con los exámenes dentro de una transacción:
 * una orden sin exámenes sería un registro inservible.
 */
async function crear({
  pacienteId,
  numeroOrden = null,
  fechaEntrega,
  fechaVencimiento,
  fechaCitaIgss = null,
  observaciones,
  examenes,
  creadoPor,
}) {
  const id = await withTransaction(async (conexion) => {
    const [resultado] = await conexion.execute(
      `INSERT INTO ordenes
         (paciente_id, numero_orden, fecha_entrega, fecha_vencimiento, fecha_cita_igss,
          observaciones, creado_por)
       VALUES (:pacienteId, :numeroOrden, :fechaEntrega, :fechaVencimiento, :fechaCitaIgss,
               :observaciones, :creadoPor)`,
      {
        pacienteId,
        numeroOrden,
        fechaEntrega,
        fechaVencimiento,
        fechaCitaIgss,
        observaciones,
        creadoPor,
      },
    );

    for (const examenId of examenes) {
      await conexion.execute(
        'INSERT INTO orden_examenes (orden_id, examen_id) VALUES (:ordenId, :examenId)',
        { ordenId: resultado.insertId, examenId },
      );
    }

    return resultado.insertId;
  });

  return buscarPorId(id);
}

async function actualizar(
  id,
  { numeroOrden, fechaEntrega, fechaVencimiento, fechaCitaIgss, observaciones, examenes },
) {
  await withTransaction(async (conexion) => {
    const asignaciones = [];
    const parametros = { id };

    if (numeroOrden !== undefined) {
      asignaciones.push('numero_orden = :numeroOrden');
      parametros.numeroOrden = numeroOrden;
    }
    if (fechaEntrega !== undefined) {
      asignaciones.push('fecha_entrega = :fechaEntrega, fecha_vencimiento = :fechaVencimiento');
      parametros.fechaEntrega = fechaEntrega;
      parametros.fechaVencimiento = fechaVencimiento;
    }
    if (fechaCitaIgss !== undefined) {
      asignaciones.push('fecha_cita_igss = :fechaCitaIgss');
      parametros.fechaCitaIgss = fechaCitaIgss;
    }
    if (observaciones !== undefined) {
      asignaciones.push('observaciones = :observaciones');
      parametros.observaciones = observaciones;
    }

    if (asignaciones.length > 0) {
      await conexion.execute(
        `UPDATE ordenes SET ${asignaciones.join(', ')} WHERE id = :id`,
        parametros,
      );
    }

    if (Array.isArray(examenes)) {
      await conexion.execute('DELETE FROM orden_examenes WHERE orden_id = :id', { id });
      for (const examenId of examenes) {
        await conexion.execute(
          'INSERT INTO orden_examenes (orden_id, examen_id) VALUES (:ordenId, :examenId)',
          { ordenId: id, examenId },
        );
      }
    }
  });

  return buscarPorId(id);
}

async function contarCitasActivas(ordenId) {
  const fila = await queryOne(
    `SELECT COUNT(*) AS total
       FROM citas c
       JOIN estados_cita ec ON ec.id = c.estado_id
      WHERE c.orden_id = :ordenId AND ec.codigo <> 'CANCELADA'`,
    { ordenId },
  );

  return Number(fila?.total ?? 0);
}

/**
 * Borra una orden con sus exámenes (que caen en cascada).
 * Solo se usa para deshacer una recepción que no llegó a crear su cita: una
 * orden sin cita no la mira nadie. Las órdenes con historial no se borran.
 */
async function eliminar(id) {
  const resultado = await query('DELETE FROM ordenes WHERE id = :id', { id });
  return Number(resultado?.affectedRows ?? 0) > 0;
}

module.exports = {
  buscarPorId,
  listarPorPaciente,
  listarPorVencer,
  crear,
  actualizar,
  eliminar,
  contarCitasActivas,
};
