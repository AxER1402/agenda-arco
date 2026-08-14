import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

const ZONA = 'America/Guatemala';

const FECHA = new Intl.DateTimeFormat('es-GT', {
  timeZone: ZONA,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const HORA = new Intl.DateTimeFormat('es-GT', {
  timeZone: ZONA,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: true,
});

/**
 * Fecha y hora del laboratorio.
 *
 * Siempre en la zona de Guatemala, no en la del equipo: el personal agenda
 * contra el reloj del laboratorio, y una máquina mal configurada no debería
 * hacerles creer que es otro día.
 */
function RelojEncabezado({ className }) {
  const [ahora, setAhora] = useState(() => new Date());

  useEffect(() => {
    const temporizador = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(temporizador);
  }, []);

  return (
    <div className={cn('flex flex-col items-end leading-none', className)}>
      <time
        dateTime={ahora.toISOString()}
        className="cifra text-base font-semibold text-titular sm:text-lg"
      >
        {HORA.format(ahora).toUpperCase()}
      </time>
      <span className="rotulo mt-1 hidden sm:block">{FECHA.format(ahora)}</span>
    </div>
  );
}

export default RelojEncabezado;
