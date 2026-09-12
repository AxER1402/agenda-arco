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

  // La fecha va delante y la hora detrás, los dos en la misma línea. Apilados
  // obligaban a la barra superior a tener dos renglones de alto, que era lo que
  // la engordaba.
  return (
    <div className={cn('flex items-baseline gap-3 leading-none', className)}>
      <span className="hidden text-sm text-muted-foreground sm:block">
        {FECHA.format(ahora)}
      </span>
      <time dateTime={ahora.toISOString()} className="cifra text-sm text-titular">
        {HORA.format(ahora).toUpperCase()}
      </time>
    </div>
  );
}

export default RelojEncabezado;
