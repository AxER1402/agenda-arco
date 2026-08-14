import api from './api';

/** Consulta el estado del backend y de su conexión con la base de datos. */
export async function obtenerEstadoSistema() {
  const [backend, baseDatos] = await Promise.allSettled([
    api.get('/health'),
    api.get('/health/db'),
  ]);

  return {
    backend: backend.status === 'fulfilled' ? 'ok' : 'error',
    baseDatos: baseDatos.status === 'fulfilled' ? 'ok' : 'error',
  };
}
