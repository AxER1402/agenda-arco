/**
 * Cliente HTTP hacia el whatsapp-service.
 *
 * El backend NO conoce whatsapp-web.js: solo sabe hacer POST /send-message.
 * Sustituir WhatsApp Web por la API oficial no obliga a tocar este archivo
 * mientras el contrato de respuesta se mantenga.
 */
const env = require('../config/env');
const AppError = require('../utils/AppError');

const TIEMPO_LIMITE_MS = 30000;

/**
 * @param {string} ruta
 * @param {object} [opciones]
 * @returns {Promise<{ok: boolean, estado: number, datos: any}>}
 */
async function peticion(ruta, opciones = {}) {
  const control = new AbortController();
  const temporizador = setTimeout(() => control.abort(), opciones.tiempoLimite ?? TIEMPO_LIMITE_MS);

  try {
    const respuesta = await fetch(`${env.whatsapp.serviceUrl}${ruta}`, {
      ...opciones,
      signal: control.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.whatsapp.apiKey,
        ...opciones.headers,
      },
    });

    const datos = await respuesta.json().catch(() => ({}));

    return { ok: respuesta.ok, estado: respuesta.status, datos };
  } finally {
    clearTimeout(temporizador);
  }
}

/**
 * Solicita el envío de un mensaje.
 *
 * Nunca lanza por un fallo de envío: devuelve siempre un resultado descriptivo
 * para que el recordatorio quede registrado como ENVIADO o FALLIDO y el
 * personal sepa a quién debe contactar por otro medio (requisito 19).
 *
 * @param {{telefono: string, mensaje: string, imagen?: string}} datos `imagen`
 *   es un data URI; si viene, el mensaje viaja como pie de la imagen.
 * @returns {Promise<{enviado: boolean, motivo?: string, detalle?: string}>}
 */
async function enviarMensaje({ telefono, mensaje, imagen }) {
  try {
    const { ok, estado, datos } = await peticion('/send-message', {
      method: 'POST',
      body: JSON.stringify({ telefono, mensaje, imagen }),
    });

    if (ok) return datos;

    return {
      enviado: false,
      motivo: estado === 503 ? 'SERVICIO_NO_LISTO' : 'ERROR_SERVICIO',
      detalle: datos?.error?.mensaje ?? `El servicio de WhatsApp respondió ${estado}.`,
    };
  } catch (error) {
    const abortado = error.name === 'AbortError';

    return {
      enviado: false,
      motivo: abortado ? 'TIEMPO_AGOTADO' : 'SERVICIO_NO_DISPONIBLE',
      detalle: abortado
        ? 'El servicio de WhatsApp no respondió a tiempo.'
        : 'No fue posible contactar con el servicio de WhatsApp.',
    };
  }
}

/** Estado de la sesión de WhatsApp, para mostrarlo en el panel. */
async function obtenerEstado() {
  try {
    const { ok, datos } = await peticion('/status', { tiempoLimite: 5000 });

    if (!ok) return { disponible: false, estado: 'DESCONECTADO' };

    return { disponible: true, ...datos };
  } catch {
    return { disponible: false, estado: 'SERVICIO_NO_DISPONIBLE' };
  }
}

/** Código QR pendiente de vincular. */
async function obtenerQr() {
  try {
    const { ok, datos } = await peticion('/qr', { tiempoLimite: 5000 });
    return ok ? datos : null;
  } catch {
    return null;
  }
}

/**
 * Cierra la sesión de WhatsApp del laboratorio.
 *
 * Aquí sí se lanza cuando el servicio no responde, al revés que en el envío: el
 * envío tiene que poder registrarse como fallido y seguir, mientras que quien
 * pulsa «desvincular» necesita saber si la cuenta quedó desvinculada o no.
 *
 * Los fallos se traducen a `AppError` a propósito. Un `Error` pelado acabaría
 * en el manejador general, que responde «Ocurrió un error interno» y esconde el
 * motivo: al que está delante de la pantalla eso no le dice si tiene que
 * reintentar, mirar los logs o levantar el contenedor.
 *
 * @returns {Promise<{desvinculada: boolean, estabaVinculada: boolean}>}
 */
async function desvincular() {
  let respuesta;

  try {
    // Corto a propósito: el servicio responde en cuanto marca la sesión como
    // cerrada, sin esperar a que Chromium se apague. Y el navegador del
    // laboratorio corta a los 10 s, así que pasarse de ahí solo cambiaría un
    // error claro por un «el servidor tardó demasiado».
    respuesta = await peticion('/logout', { method: 'POST', tiempoLimite: 8000 });
  } catch (error) {
    throw new AppError(
      error.name === 'AbortError'
        ? 'El servicio de WhatsApp no respondió a tiempo. Compruebe que el contenedor arco-whatsapp esté en ejecución y vuelva a intentarlo.'
        : 'No fue posible contactar con el servicio de WhatsApp. Compruebe que el contenedor arco-whatsapp esté en ejecución.',
      503,
    );
  }

  const { ok, estado, datos } = respuesta;

  if (!ok) {
    throw new AppError(
      datos?.error?.mensaje ??
        `El servicio de WhatsApp respondió ${estado} al intentar desvincular la cuenta.`,
      502,
    );
  }

  return datos;
}

module.exports = { enviarMensaje, obtenerEstado, obtenerQr, desvincular };
