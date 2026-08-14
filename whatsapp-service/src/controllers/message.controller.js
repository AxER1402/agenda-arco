const messageService = require('../services/message.service');
const whatsappClient = require('../whatsapp/client');

/** GET /status — el backend y el dashboard consultan si la sesión está activa. */
function getStatus(req, res) {
  res.status(200).json({ servicio: 'whatsapp-service', ...whatsappClient.getEstado() });
}

/**
 * GET /qr — código QR pendiente de escanear.
 * Devuelve la imagen (data URI PNG) para pintarla directamente en la interfaz,
 * y la cadena original por si hiciera falta generarla de otra forma.
 */
function getQr(req, res) {
  const qr = whatsappClient.getQr();

  if (!qr) {
    const { listo } = whatsappClient.getEstado();
    return res.status(404).json({
      error: {
        mensaje: listo
          ? 'La sesión ya está vinculada; no hay código QR pendiente.'
          : 'Todavía no se ha generado un código QR. Intente en unos segundos.',
      },
    });
  }

  return res.status(200).json(qr);
}

/**
 * POST /logout — cierra la sesión vinculada.
 *
 * Responde 200 aunque no hubiera nada que cerrar: el resultado que le interesa
 * a quien lo pide es «ya no hay cuenta vinculada», y eso se cumple igual.
 */
async function logout(req, res, next) {
  try {
    const resultado = await whatsappClient.desvincular();
    return res.status(200).json({ ...resultado, ...whatsappClient.getEstado() });
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /send-message — punto de entrada que usa el backend.
 *
 * Devuelve 200 tanto si se envió como si no: un número sin WhatsApp no es un
 * error del servicio, es un resultado que el backend debe registrar. Solo se
 * responde 4xx/5xx cuando la petición está mal formada o el servicio no puede
 * operar.
 */
async function sendMessage(req, res, next) {
  try {
    const { telefono, mensaje, imagen } = req.body ?? {};
    const resultado = await messageService.enviarMensaje({ telefono, mensaje, imagen });

    if (resultado.motivo === 'SOLICITUD_INVALIDA') {
      return res.status(400).json({ error: { mensaje: resultado.detalle } });
    }

    if (resultado.motivo === 'SERVICIO_NO_LISTO') {
      return res.status(503).json({ error: { mensaje: resultado.detalle }, ...resultado });
    }

    return res.status(200).json(resultado);
  } catch (error) {
    return next(error);
  }
}

module.exports = { getStatus, getQr, logout, sendMessage };
