/**
 * Acceso a datos de pacientes.
 */
const { query, queryOne, withTransaction } = require('../config/database');

const CAMPOS = `
  id, nombre_completo, telefono, dpi, tiene_whatsapp, notas, activo, creado_en, actualizado_en
`;

async function buscarPorId(id) {
  return queryOne(`SELECT ${CAMPOS} FROM pacientes WHERE id = :id`, { id });
}

/**
 * Búsqueda por nombre, teléfono o DPI con paginación.
 * El LIKE lleva el comodín solo al final del nombre para poder aprovechar el
 * índice; el teléfono y el DPI se comparan por prefijo por el mismo motivo.
 */
async function buscar({ termino = '', incluirInactivos = false, limite = 20, desplazamiento = 0 }) {
  const filtro = `${termino.trim()}%`;
  const parametros = {
    filtro,
    filtroInterno: `%${termino.trim()}%`,
    incluirInactivos: incluirInactivos ? 1 : 0,
  };

  // LIMIT/OFFSET no admiten parámetros preparados en MySQL con mysql2, así que
  // se interpolan; para que eso sea seguro se fuerzan a entero y se acotan.
  const limiteSeguro = Math.min(Math.max(Number.parseInt(limite, 10) || 20, 1), 100);
  const desplazamientoSeguro = Math.max(Number.parseInt(desplazamiento, 10) || 0, 0);

  const filas = await query(
    `SELECT ${CAMPOS}
       FROM pacientes
      WHERE (:incluirInactivos = 1 OR activo = 1)
        AND (:filtro = '%' OR nombre_completo LIKE :filtroInterno OR telefono LIKE :filtro
             OR dpi LIKE :filtro)
      ORDER BY nombre_completo
      LIMIT ${limiteSeguro} OFFSET ${desplazamientoSeguro}`,
    parametros,
  );

  const total = await queryOne(
    `SELECT COUNT(*) AS total
       FROM pacientes
      WHERE (:incluirInactivos = 1 OR activo = 1)
        AND (:filtro = '%' OR nombre_completo LIKE :filtroInterno OR telefono LIKE :filtro
             OR dpi LIKE :filtro)`,
    { filtro, filtroInterno: parametros.filtroInterno, incluirInactivos: parametros.incluirInactivos },
  );

  return { pacientes: filas, total: Number(total?.total ?? 0) };
}

/** Pacientes con el mismo teléfono: sirve para avisar de posibles duplicados. */
async function buscarPorTelefono(telefono, excluirId = null) {
  return query(
    `SELECT ${CAMPOS}
       FROM pacientes
      WHERE telefono = :telefono
        AND activo = 1
        AND (:excluirId IS NULL OR id <> :excluirId)`,
    { telefono, excluirId },
  );
}

/** Pacientes con el mismo DPI: sirve para avisar de posibles duplicados. */
async function buscarPorDpi(dpi, excluirId = null) {
  return query(
    `SELECT ${CAMPOS}
       FROM pacientes
      WHERE dpi = :dpi
        AND activo = 1
        AND (:excluirId IS NULL OR id <> :excluirId)`,
    { dpi, excluirId },
  );
}

async function crear({
  nombreCompleto,
  telefono,
  dpi = null,
  notas = null,
  // NULL = no se sabe todavía si ese número tiene WhatsApp.
  tieneWhatsapp = null,
}) {
  const resultado = await query(
    `INSERT INTO pacientes (nombre_completo, telefono, dpi, notas, tiene_whatsapp)
     VALUES (:nombreCompleto, :telefono, :dpi, :notas, :tieneWhatsapp)`,
    { nombreCompleto, telefono, dpi, notas, tieneWhatsapp },
  );
  return buscarPorId(resultado.insertId);
}

async function actualizar(id, cambios) {
  const columnas = {
    nombreCompleto: 'nombre_completo',
    telefono: 'telefono',
    dpi: 'dpi',
    notas: 'notas',
    activo: 'activo',
    tieneWhatsapp: 'tiene_whatsapp',
  };

  const asignaciones = [];
  const parametros = { id };

  Object.entries(cambios).forEach(([clave, valor]) => {
    if (valor === undefined || !columnas[clave]) return;
    asignaciones.push(`${columnas[clave]} = :${clave}`);
    parametros[clave] = valor;
  });

  if (asignaciones.length > 0) {
    await query(`UPDATE pacientes SET ${asignaciones.join(', ')} WHERE id = :id`, parametros);
  }

  return buscarPorId(id);
}

/**
 * Marca si el número resultó tener WhatsApp o no.
 * Lo alimenta el resultado real de los envíos (requisito 19).
 */
async function registrarResultadoWhatsapp(id, tieneWhatsapp) {
  await query('UPDATE pacientes SET tiene_whatsapp = :tieneWhatsapp WHERE id = :id', {
    id,
    tieneWhatsapp: tieneWhatsapp ? 1 : 0,
  });
}

async function tieneCitas(id) {
  const fila = await queryOne('SELECT COUNT(*) AS total FROM citas WHERE paciente_id = :id', { id });
  return Number(fila?.total ?? 0) > 0;
}

/**
 * Borrado físico. La baja normal de un paciente es lógica (`activo = 0`), y así
 * debe seguir siendo: su historial de citas tiene que conservarse.
 *
 * Esto existe solo para deshacer un registro que acaba de nacer y quedó
 * huérfano: la recepción creó al paciente y la cita falló a continuación. La
 * clave foránea de `citas` es RESTRICT, así que un paciente con historial nunca
 * podría borrarse por aquí.
 */
async function eliminar(id) {
  const resultado = await query('DELETE FROM pacientes WHERE id = :id', { id });
  return Number(resultado?.affectedRows ?? 0) > 0;
}

/** Cuántas citas y órdenes cuelgan del paciente. Se usa para avisar y para el
 *  mensaje de lo que se acaba de borrar. */
async function contarHistorial(id) {
  const fila = await queryOne(
    `SELECT
       (SELECT COUNT(*) FROM citas   WHERE paciente_id = :id) AS citas,
       (SELECT COUNT(*) FROM ordenes WHERE paciente_id = :id) AS ordenes`,
    { id },
  );

  return { citas: Number(fila?.citas ?? 0), ordenes: Number(fila?.ordenes ?? 0) };
}

/**
 * Borrado del paciente y de todo lo que cuelga de él.
 *
 * Las claves foráneas de `citas` y `ordenes` son RESTRICT, así que hay que
 * bajarlas en orden y en una sola transacción: o desaparece todo, o no
 * desaparece nada. Los exámenes de cada cita y de cada orden, y el recordatorio
 * de cada cita, se van solos (CASCADE).
 */
async function eliminarConHistorial(id) {
  return withTransaction(async (conexion) => {
    const [citas] = await conexion.execute('DELETE FROM citas WHERE paciente_id = :id', { id });
    const [ordenes] = await conexion.execute('DELETE FROM ordenes WHERE paciente_id = :id', { id });
    await conexion.execute('DELETE FROM pacientes WHERE id = :id', { id });

    return {
      citas: Number(citas?.affectedRows ?? 0),
      ordenes: Number(ordenes?.affectedRows ?? 0),
    };
  });
}

module.exports = {
  buscarPorId,
  buscar,
  buscarPorTelefono,
  buscarPorDpi,
  crear,
  actualizar,
  eliminar,
  eliminarConHistorial,
  contarHistorial,
  registrarResultadoWhatsapp,
  tieneCitas,
};
