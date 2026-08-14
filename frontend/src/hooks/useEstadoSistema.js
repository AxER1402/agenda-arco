import { useCallback, useEffect, useState } from 'react';

import { obtenerEstadoSistema } from '@/services/health.service';

/**
 * Encapsula la consulta del estado del sistema.
 * Regla del proyecto: los componentes no llaman a los servicios directamente ni
 * manejan estados de carga a mano; eso vive en hooks.
 */
export function useEstadoSistema() {
  const [estado, setEstado] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const consultar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setEstado(await obtenerEstadoSistema());
    } catch (problema) {
      setError(problema.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    consultar();
  }, [consultar]);

  return { estado, cargando, error, recargar: consultar };
}
