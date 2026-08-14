import { useEffect, useState } from 'react';

/** Espera a que el usuario deje de escribir antes de consultar al servidor. */
export function useTerminoRetrasado(termino, retraso = 350) {
  const [retrasado, setRetrasado] = useState(termino);

  useEffect(() => {
    const temporizador = setTimeout(() => setRetrasado(termino), retraso);
    return () => clearTimeout(temporizador);
  }, [termino, retraso]);

  return retrasado;
}

export default useTerminoRetrasado;
