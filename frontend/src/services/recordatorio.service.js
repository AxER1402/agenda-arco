import api from './api';

export async function listarRecordatorios({ estado, desde, hasta } = {}) {
  const { data } = await api.get('/recordatorios', { params: { estado, desde, hasta } });
  return data;
}

export async function obtenerResumenRecordatorios() {
  const { data } = await api.get('/recordatorios/resumen');
  return data;
}

export async function prepararRecordatorios(fecha) {
  const { data } = await api.post('/recordatorios/preparar', { fecha });
  return data;
}

export async function enviarRecordatoriosPendientes() {
  const { data } = await api.post('/recordatorios/enviar');
  return data;
}

/**
 * Envía ahora el recordatorio de una cita concreta, sin esperar al proceso
 * diario. Devuelve `{ enviado, recordatorio, paciente }`.
 */
export async function enviarRecordatorioDeCita(citaId) {
  const { data } = await api.post(`/recordatorios/cita/${citaId}`);
  return data;
}

export async function reintentarRecordatorio(id) {
  const { data } = await api.post(`/recordatorios/${id}/reintentar`);
  return data;
}

/**
 * Texto e imagen con los que se arma el recordatorio.
 * @returns {Promise<{plantilla: string, imagen: string|null, marcadores: object,
 *   por_defecto: string, ejemplo: string}>}
 */
export async function obtenerPlantilla() {
  const { data } = await api.get('/recordatorios/plantilla');
  return data;
}

/**
 * Guarda el mensaje, la imagen o ambos. Lo que no se envía no se toca; para
 * quitar la imagen hay que mandar `imagen: ''`.
 */
export async function guardarPlantilla({ plantilla, imagen }) {
  const { data } = await api.put('/recordatorios/plantilla', { plantilla, imagen });
  return data;
}

/** Cómo quedaría el mensaje con este texto, sin guardarlo. */
export async function previsualizarPlantilla(plantilla) {
  const { data } = await api.post('/recordatorios/plantilla/previsualizar', { plantilla });
  return data;
}

export async function obtenerEstadoWhatsapp() {
  const { data } = await api.get('/recordatorios/whatsapp/estado');
  return data;
}

/**
 * Cierra la sesión de WhatsApp del laboratorio. Solo administrador.
 * @returns {Promise<{desvinculada: boolean, estabaVinculada: boolean, mensaje: string}>}
 */
export async function desvincularWhatsapp() {
  const { data } = await api.post('/recordatorios/whatsapp/desvincular');
  return data;
}

/**
 * Código QR para vincular la cuenta.
 * @returns {Promise<{qr: string, imagen: string|null}|null>} null cuando la
 *   sesión ya está vinculada o el código todavía no se ha generado.
 */
export async function obtenerQrWhatsapp() {
  try {
    const { data } = await api.get('/recordatorios/whatsapp/qr');
    return data;
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}
