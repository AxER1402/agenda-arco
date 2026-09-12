import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * Campo de contraseña con un botón para verla.
 *
 * Sirve para comprobar lo que se ha escrito antes de enviarlo: en un teclado de
 * mostrador, con el texto oculto, un error de tecleo solo se descubre cuando el
 * acceso ya ha fallado.
 *
 * Empieza siempre oculta y solo se muestra si se pide expresamente.
 *
 * El botón va dentro del campo, con la misma forma que un `Button` de variante
 * `ghost`: el control sigue siendo uno solo.
 *
 * @param {object} props Los mismos que `Input`; `className` se aplica al campo.
 */
function InputContrasena({ className, ...props }) {
  const [visible, setVisible] = useState(false);

  const Icono = visible ? EyeOff : Eye;

  return (
    <div className="relative">
      <Input {...props} type={visible ? 'text' : 'password'} className={cn('pr-11', className)} />

      {/* Entra en el orden de tabulación: quien no use ratón también tiene que
          poder comprobar lo que escribió. */}
      <button
        type="button"
        onClick={() => setVisible((mostrada) => !mostrada)}
        aria-pressed={visible}
        className={cn(
          'absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center',
          'rounded-md text-muted-foreground outline-none',
          'transition-colors hover:bg-accent hover:text-accent-foreground',
          'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
        )}
      >
        <Icono className="size-4" aria-hidden="true" />
        <span className="sr-only">{visible ? 'Ocultar la contraseña' : 'Ver la contraseña'}</span>
      </button>
    </div>
  );
}

export { InputContrasena };
