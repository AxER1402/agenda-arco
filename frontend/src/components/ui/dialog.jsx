import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

import { cn } from '@/lib/utils';

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;

/**
 * El diálogo cambia de forma con el ancho.
 *
 * En un teléfono ocupa la pantalla entera y desde `sm` es el cuadro centrado de
 * siempre. La pantalla completa no es un capricho de estilo: un diálogo fijado
 * al pie queda **debajo del teclado virtual** en cuanto se toca un campo —el
 * teclado no encoge el viewport de diseño, así que el navegador no tiene a
 * dónde desplazarlo—, y eso dejaba formularios como el de registrar paciente
 * imposibles de rellenar desde el móvil. Anclado arriba y a toda la altura, el
 * navegador sí puede subir el campo con foco dentro del área que se desplaza.
 *
 * Ese desplazamiento vive en un envoltorio interior, no en el propio diálogo:
 * así el cuadro de cierre se queda clavado en el canto superior derecho en vez
 * de irse hacia arriba en cuanto el formulario es largo, que en móvil dejaba
 * la única salida fuera de la pantalla.
 *
 * Las alturas van en `dvh` y no en `vh` porque en el navegador del teléfono la
 * barra de direcciones entra y sale: con `vh` el pie del formulario quedaba
 * debajo de ella.
 */
function DialogContent({ className, children, ...props }) {
  return (
    <DialogPrimitive.Portal>
      {/* Velo oscuro traslúcido: sin sombra en el modal, es lo único que lo
          separa de la página de atrás. */}
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-abismo/50" />
      <DialogPrimitive.Content
        className={cn(
          'fixed z-50 flex flex-col rounded-none border-0 border-trazo bg-card',
          'inset-0 w-full',
          'sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[calc(100vw-2rem)] sm:max-w-lg',
          'sm:max-h-[calc(100dvh-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:border-2',
          className,
        )}
        {...props}
      >
        {/* El relleno de abajo respeta la franja del gesto de inicio en los
            teléfonos sin botón: sin él, el último botón queda debajo. */}
        <div className="grid gap-5 overflow-y-auto overscroll-contain p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-6">
          {children}
        </div>

        {/* Pegado al canto superior derecho, sin margen: el cuadrado de cierre
            forma parte del marco. */}
        <DialogPrimitive.Close
          className={cn(
            'absolute right-0 top-0 flex size-11 items-center justify-center sm:size-10',
            'border-b-2 border-l-2 border-trazo bg-secondary text-titular',
            'transition-colors duration-100 hover:bg-primary',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
          )}
        >
          <X className="size-4" aria-hidden="true" />
          <span className="sr-only">Cerrar</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

function DialogHeader({ className, ...props }) {
  return <div className={cn('flex flex-col gap-1.5 pr-11', className)} {...props} />;
}

/**
 * En móvil los botones van apilados y a todo lo ancho —el de confirmar arriba,
 * por `flex-col-reverse`—; desde `sm`, en fila y alineados a la derecha.
 */
function DialogFooter({ className, ...props }) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end',
        '[&>button]:w-full sm:[&>button]:w-auto',
        className,
      )}
      {...props}
    />
  );
}

function DialogTitle({ className, ...props }) {
  return <DialogPrimitive.Title className={cn('text-2xl leading-tight', className)} {...props} />;
}

function DialogDescription({ className, ...props }) {
  return (
    <DialogPrimitive.Description
      className={cn('text-sm leading-relaxed text-muted-foreground', className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
