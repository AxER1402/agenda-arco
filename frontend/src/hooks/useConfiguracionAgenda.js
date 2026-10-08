import { useEffect, useState } from 'react';

import { obtenerConfiguracion } from '@/services/catalogo.service';

/**
 * Configuración de la agenda (días de atención, feriados, hora predeterminada
 * de la cita) para los formularios que dan o mueven citas.
 *
 * Se vuelve a pedir cada vez que `activo` pasa a verdadero —al abrir el
 * diálogo—, así un feriado recién agregado ya sale apagado. Si falla, queda en
 * `null` y el formulario funciona igual: el backend sigue rechazando los días
 * cerrados.
 *
 * @param {boolean} [activo]
 */
export function useConfiguracionAgenda(activo = true) {
  const [configuracion, setConfiguracion] = useState(null);

  useEffect(() => {
    if (!activo) return undefined;

    let cancelado = false;

    Promise.resolve(obtenerConfiguracion())
      .then((datos) => !cancelado && setConfiguracion(datos ?? null))
      .catch(() => !cancelado && setConfiguracion(null));

    return () => {
      cancelado = true;
    };
  }, [activo]);

  return configuracion;
}
