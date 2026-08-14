const crypto = require('node:crypto');
const env = require('../config/env');

/**
 * Comparación en tiempo constante.
 * Un `===` normal termina en cuanto encuentra el primer carácter distinto, lo
 * que permitiría deducir la clave midiendo tiempos de respuesta.
 */
function clavesIguales(recibida, esperada) {
  const bufferRecibida = Buffer.from(String(recibida ?? ''), 'utf8');
  const bufferEsperada = Buffer.from(esperada, 'utf8');

  // timingSafeEqual exige la misma longitud; comparar longitudes antes no
  // filtra la clave, solo su tamaño.
  if (bufferRecibida.length !== bufferEsperada.length) return false;

  return crypto.timingSafeEqual(bufferRecibida, bufferEsperada);
}

/**
 * El whatsapp-service solo debe ser accesible por el backend.
 * Se exige una clave compartida en la cabecera x-api-key.
 */
function requireApiKey(req, res, next) {
  if (!env.apiKey) {
    return res.status(500).json({
      error: { mensaje: 'INTERNAL_API_KEY no está configurada en el servicio.' },
    });
  }

  if (!clavesIguales(req.get('x-api-key'), env.apiKey)) {
    return res.status(401).json({ error: { mensaje: 'Clave interna inválida.' } });
  }

  return next();
}

module.exports = { requireApiKey };
