const bcrypt = require('bcryptjs');

/**
 * Hashing de contraseñas.
 * Se usa bcryptjs (implementación en JavaScript puro) para no depender de
 * compilación nativa dentro de la imagen de Docker.
 */
const RONDAS = 10;

/** @returns {Promise<string>} hash listo para guardar en la base. */
function hashear(passwordPlano) {
  return bcrypt.hash(passwordPlano, RONDAS);
}

/** Compara la contraseña recibida con el hash almacenado. */
function verificar(passwordPlano, hash) {
  return bcrypt.compare(passwordPlano, hash);
}

module.exports = { hashear, verificar, RONDAS };
