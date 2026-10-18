const { OAuth2Client } = require('google-auth-library');
const env = require('../config/env');

/**
 * Verificación de la credencial que entrega «Continuar con Google».
 *
 * La credencial es un JWT firmado por Google. La librería comprueba la firma
 * contra las claves públicas de Google (las guarda en caché), la caducidad y
 * que el token se emitió para nuestro identificador de cliente: un token
 * pensado para otra aplicación no sirve aquí.
 */
let cliente = null;

function obtenerCliente() {
  if (!cliente) cliente = new OAuth2Client(env.google.clientId);
  return cliente;
}

/**
 * @param {string} credencial El `credential` que devuelve Google al navegador.
 * @returns {Promise<{ correo: string, correoVerificado: boolean, nombre?: string }>}
 * @throws {Error} si la firma, la audiencia o la caducidad no cuadran.
 */
async function verificarCredencial(credencial) {
  const ticket = await obtenerCliente().verifyIdToken({
    idToken: credencial,
    audience: env.google.clientId,
  });
  const payload = ticket.getPayload();

  return {
    correo: String(payload.email ?? '').toLowerCase(),
    correoVerificado: payload.email_verified === true,
    nombre: payload.name,
  };
}

module.exports = { verificarCredencial };
