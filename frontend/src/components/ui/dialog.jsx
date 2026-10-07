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
 * así el botón de cierre se queda clavado en el canto superior derecho en vez
 * de irse hacia arriba en cuanto el formulario es largo, que en móvil dejaba la
 * única salida fuera de la pantalla.
 *
 * Las alturas van en `dvh` y no en `vh` porque en el navegador del teléfono la
 * barra de direcciones entra y sale: con `vh` el pie del formulario quedaba
 * debajo de ella.
 *
 * A pantalla completa va sin radio ni borde —el canto redondeado contra el
 * borde del teléfono se ve como un error—, y desde `sm` recupera los de la
 * librería.
 *
 * Con `soloCierreExplicito` el diálogo no se cierra al pulsar fuera ni con
 * Escape: solo con su botón de cancelar o con la X. Es para los formularios
 * largos, donde un clic perdido junto al borde tiraba todo lo escrito.
 */
function DialogContent({
  className,
  children,
  soloCierreExplicito = false,
  onInteractOutside,
  onEscapeKeyDown,
  ...props
}) {
  return (
    <DialogPrimitive.Portal>
      {/* El fondo no se tapa: se desenfoca. Lo que dice que la página está
          fuera de juego es el desenfoque, no la oscuridad, así que el tinte es
          muy flojo y el trabajo sigue viéndose entero por debajo. */}
      <DialogPrimitive.Overlay className="velo fixed inset-0 z-50" />
      <DialogPrimitive.Content
        className={cn(
          'superficie-flotante fixed z-50 flex flex-col shadow-lg',
          'inset-0 w-full',
          'sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[calc(100vw-2rem)] sm:max-w-lg',
          'sm:max-h-[calc(100dvh-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2',
          'sm:rounded-xl sm:border',
          className,
        )}
        onInteractOutside={(evento) => {
          if (soloCierreExplicito) evento.preventDefault();
          onInteractOutside?.(evento);
        }}
        onEscapeKeyDown={(evento) => {
          if (soloCierreExplicito) evento.preventDefault();
          onEscapeKeyDown?.(evento);
        }}
        {...props}
      >
        {/* El relleno de abajo respeta la franja del gesto de inicio en los
            teléfonos sin botón: sin él, el último botón queda debajo. */}
        <div className="grid gap-5 overflow-y-auto overscroll-contain p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-6">
          {children}
        </div>

        {/* Botón de cierre en la esquina, como el de shadcn: sin relleno hasta
            que se pasa por encima. */}
        <DialogPrimitive.Close
          className={cn(
            'absolute right-4 top-4 flex size-8 items-center justify-center',
            'rounded-sm text-muted-foreground opacity-70 outline-none transition-opacity',
            'hover:opacity-100 focus-visible:ring-[3px] focus-visible:ring-ring/50',
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
  return <DialogPrimitive.Title className={cn('text-lg font-semibold leading-none', className)} {...props} />;
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
