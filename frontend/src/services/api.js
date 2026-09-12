import axios from 'axios';

/**
 * Cliente HTTP único hacia el backend.
 * Ningún componente debe llamar a axios directamente: así el día que cambie la
 * autenticación o el manejo de errores se toca un solo archivo.
 */
const baseURL = import.meta.env?.VITE_API_URL ?? 'http://localhost:3000/api';

export const api = axios.create({
  baseURL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Adjunta el token JWT a cada petición.
 * El almacenamiento del token se implementa en la fase 2 (autenticación).
 */
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('arco_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * El cuerpo del error, ya como objeto.
 *
 * Las descargas (los reportes) piden `responseType: 'blob'`, y entonces axios
 * entrega también el error como Blob. Sin desenvolverlo, un 422 con su motivo
 * en español acabaría mostrándose como «No fue posible conectar con el
 * servidor», que es justo lo contrario de lo que ha pasado.
 */
async function cuerpoDelError(respuesta) {
  const datos = respuesta?.data;

  if (typeof Blob !== 'undefined' && datos instanceof Blob) {
    try {
      return JSON.parse(await datos.text());
    } catch {
      return null;
    }
  }

  return datos;
}

/**
 * Normaliza los errores: los componentes reciben siempre un Error con un
 * mensaje en español listo para mostrar.
 */
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const cuerpo = await cuerpoDelError(error.response);

    const mensaje =
      cuerpo?.error?.mensaje ??
      (error.code === 'ECONNABORTED'
        ? 'El servidor tardó demasiado en responder.'
        : 'No fue posible conectar con el servidor.');

    const normalizado = new Error(mensaje);
    normalizado.status = error.response?.status ?? 0;
    normalizado.detalles = cuerpo?.error?.detalles;

    return Promise.reject(normalizado);
  },
);

export default api;
