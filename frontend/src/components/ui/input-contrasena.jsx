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
 * @param {object} props Los mismos que `Input`; `className` se aplica al campo.
 */
function InputContrasena({ className, ...props }) {
  const [visible, setVisible] = useState(false);

  const Icono = visible ? EyeOff : Eye;

  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? 'text' : 'password'}
        className={cn('pr-12', className)}
      />

      {/* Entra en el orden de tabulación: quien no use ratón también tiene que
          poder comprobar lo que escribió. */}
      <button
        type="button"
        onClick={() => setVisible((mostrada) => !mostrada)}
        aria-pressed={visible}
        className={cn(
          'absolute right-0 top-0 flex h-11 w-11 items-center justify-center',
          'border-l-2 border-trazo text-titular',
          'transition-colors duration-100 hover:bg-primary',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
        )}
      >
        <Icono className="size-4" aria-hidden="true" />
        <span className="sr-only">{visible ? 'Ocultar la contraseña' : 'Ver la contraseña'}</span>
      </button>
    </div>
  );
}

export { InputContrasena };
