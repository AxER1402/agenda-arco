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
 * Normaliza los errores: los componentes reciben siempre un Error con un
 * mensaje en español listo para mostrar.
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const mensaje =
      error.response?.data?.error?.mensaje ??
      (error.code === 'ECONNABORTED'
        ? 'El servidor tardó demasiado en responder.'
        : 'No fue posible conectar con el servidor.');

    const normalizado = new Error(mensaje);
    normalizado.status = error.response?.status ?? 0;
    normalizado.detalles = error.response?.data?.error?.detalles;

    return Promise.reject(normalizado);
  },
);

export default api;
