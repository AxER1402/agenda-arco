const jwt = require('jsonwebtoken');
const env = require('../config/env');

/**
 * Genera el token de sesión.
 * El payload solo lleva lo indispensable para autorizar: nunca la contraseña
 * ni datos sensibles, porque el contenido de un JWT es legible por cualquiera.
 */
function firmar({ id, usuario, rol }) {
  return jwt.sign({ sub: id, usuario, rol }, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn,
  });
}

/**
 * Verifica y decodifica un token.
 * @throws {Error} si está vencido o la firma no coincide.
 */
function verificar(token) {
  return jwt.verify(token, env.jwt.secret);
}

module.exports = { firmar, verificar };
