/**
 * Códigos de rol. Deben coincidir con la columna `roles.codigo` de la base.
 * Se centralizan aquí para no repetir cadenas sueltas por todo el código.
 */
const ROLES = {
  ADMINISTRADOR: 'ADMINISTRADOR',
  PERSONAL_CITAS: 'PERSONAL_CITAS',
};

const TODOS_LOS_ROLES = Object.values(ROLES);

module.exports = { ROLES, TODOS_LOS_ROLES };
