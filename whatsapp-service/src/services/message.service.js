/**
 * Reglas del servicio de mensajería.
 * Valida la petición del backend y delega el envío al cliente de WhatsApp.
 */
const whatsappClient = require('../whatsapp/client');

const TELEFONO_GT = /^[0-9]{8}$/;

/** Imagen adjunta: data URI en base64 de un formato que WhatsApp muestra. */
const IMAGEN_DATA_URI = /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

/**
 * @param {{telefono: string, mensaje: string, imagen?: string}} payload
 * @returns {{valido: boolean, errores: string[]}}
 */
function validarSolicitud(payload = {}) {
  const errores = [];
  const { telefono, mensaje, imagen } = payload;

  if (typeof telefono !== 'string' || !TELEFONO_GT.test(telefono)) {
    errores.push('El teléfono debe ser un número de Guatemala de 8 dígitos.');
  }

  if (typeof mensaje !== 'string' || mensaje.trim().length === 0) {
    errores.push('El mensaje no puede estar vacío.');
  }

  // La imagen es opcional: no mandarla es el caso normal.
  if (imagen !== undefined && imagen !== null && imagen !== '') {
    if (typeof imagen !== 'string' || !IMAGEN_DATA_URI.test(imagen)) {
      errores.push('La imagen debe ser un data URI PNG, JPG o WEBP en base64.');
    }
  }

  return { valido: errores.length === 0, errores };
}

/**
 * Envía un mensaje y devuelve siempre un resultado descriptivo: el backend
 * necesita distinguir "fallido por número sin WhatsApp" de "fallido por error"
 * para registrar el recordatorio correctamente.
 */
async function enviarMensaje({ telefono, mensaje, imagen }) {
  const validacion = validarSolicitud({ telefono, mensaje, imagen });

  if (!validacion.valido) {
    return {
      enviado: false,
      motivo: 'SOLICITUD_INVALIDA',
      detalle: validacion.errores.join(' '),
    };
  }

  return whatsappClient.enviarMensaje(telefono, mensaje.trim(), imagen || null);
}

module.exports = { validarSolicitud, enviarMensaje };
