/**
 * Acceso a datos de usuarios y roles.
 * Esta capa solo habla SQL: no valida, no decide y no lanza errores de negocio.
 */
const { query, queryOne } = require('../config/database');

const CAMPOS_PUBLICOS = `
  u.id, u.nombre_completo, u.usuario, u.activo, u.ultimo_acceso,
  u.creado_en, u.rol_id, r.codigo AS rol, r.nombre AS rol_nombre
`;

/** Incluye el hash de la contraseña: usar solo para autenticar. */
async function buscarPorUsuarioConPassword(usuario) {
  return queryOne(
    `SELECT ${CAMPOS_PUBLICOS}, u.password_hash
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
      WHERE u.usuario = :usuario`,
    { usuario },
  );
}

async function buscarPorId(id) {
  return queryOne(
    `SELECT ${CAMPOS_PUBLICOS}
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
      WHERE u.id = :id`,
    { id },
  );
}

async function existeUsuario(nombreUsuario, excluirId = null) {
  const fila = await queryOne(
    `SELECT id FROM usuarios
      WHERE usuario = :usuario AND (:excluirId IS NULL OR id <> :excluirId)`,
    { usuario: nombreUsuario, excluirId },
  );
  return Boolean(fila);
}

async function listar({ incluirInactivos = false } = {}) {
  return query(
    `SELECT ${CAMPOS_PUBLICOS}
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
      WHERE (:incluirInactivos = 1 OR u.activo = 1)
      ORDER BY u.nombre_completo`,
    { incluirInactivos: incluirInactivos ? 1 : 0 },
  );
}

async function crear({ nombreCompleto, usuario, passwordHash, rolId }) {
  const resultado = await query(
    `INSERT INTO usuarios (nombre_completo, usuario, password_hash, rol_id)
     VALUES (:nombreCompleto, :usuario, :passwordHash, :rolId)`,
    { nombreCompleto, usuario, passwordHash, rolId },
  );
  return buscarPorId(resultado.insertId);
}

/** Actualiza solo los campos presentes en `cambios`. */
async function actualizar(id, cambios) {
  const columnas = {
    nombreCompleto: 'nombre_completo',
    usuario: 'usuario',
    rolId: 'rol_id',
    activo: 'activo',
    passwordHash: 'password_hash',
  };

  const asignaciones = [];
  const parametros = { id };

  Object.entries(cambios).forEach(([clave, valor]) => {
    if (valor === undefined || !columnas[clave]) return;
    asignaciones.push(`${columnas[clave]} = :${clave}`);
    parametros[clave] = valor;
  });

  if (asignaciones.length > 0) {
    await query(`UPDATE usuarios SET ${asignaciones.join(', ')} WHERE id = :id`, parametros);
  }

  return buscarPorId(id);
}

async function registrarAcceso(id) {
  await query('UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = :id', { id });
}

async function contarAdministradoresActivos() {
  const fila = await queryOne(
    `SELECT COUNT(*) AS total
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
      WHERE r.codigo = 'ADMINISTRADOR' AND u.activo = 1`,
  );
  return Number(fila?.total ?? 0);
}

async function buscarRolPorCodigo(codigo) {
  return queryOne('SELECT id, codigo, nombre FROM roles WHERE codigo = :codigo', { codigo });
}

async function listarRoles() {
  return query('SELECT id, codigo, nombre, descripcion FROM roles ORDER BY id');
}

module.exports = {
  buscarPorUsuarioConPassword,
  buscarPorId,
  existeUsuario,
  listar,
  crear,
  actualizar,
  registrarAcceso,
  contarAdministradoresActivos,
  buscarRolPorCodigo,
  listarRoles,
};
