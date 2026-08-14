import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import CampoFormulario from '@/components/CampoFormulario';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

/**
 * Confirmación de una acción, dentro de la aplicación.
 *
 * Sustituye a `window.confirm` y `window.prompt`, que no se pueden leer con
 * calma —se cierran con Enter sin haberlos mirado—, no distinguen una
 * cancelación de un borrado, no admiten un campo de contraseña y aparecen con
 * el aspecto del navegador en lugar del sistema.
 *
 * Tres piezas opcionales, según lo que haya que pedir:
 *   - solo confirmar (desactivar un examen)
 *   - `campo`: un dato más (el motivo de una cancelación, una contraseña nueva)
 *   - `pedirContrasena`: la contraseña de la sesión, para lo irreversible
 *
 * `onConfirmar` recibe `{ valor, contrasena }` y puede lanzar: el mensaje del
 * error se muestra dentro y el diálogo sigue abierto, que es lo que hace falta
 * cuando la contraseña no era la correcta.
 *
 * @param {object} props
 * @param {boolean} props.abierto
 * @param {() => void} props.onCerrar
 * @param {(datos: {valor?: string, contrasena?: string}) => Promise<void>} props.onConfirmar
 * @param {string} props.titulo
 * @param {import('react').ReactNode} [props.descripcion]
 * @param {string} [props.textoConfirmar]
 * @param {boolean} [props.destructivo] Tiñe de rojo el botón que confirma.
 * @param {boolean} [props.pedirContrasena] Exige la contraseña de la sesión.
 * @param {{etiqueta: string, ayuda?: string, tipo?: string, requerido?: boolean,
 *   minimo?: number}} [props.campo] Dato adicional que se pide.
 */
function DialogoConfirmacion({
  abierto,
  onCerrar,
  onConfirmar,
  titulo,
  descripcion,
  textoConfirmar = 'Confirmar',
  destructivo = false,
  pedirContrasena = false,
  campo = null,
}) {
  const [valor, setValor] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  // Cada apertura empieza limpia: lo escrito la vez anterior no debe quedarse
  // —menos aún una contraseña—, y un error viejo confundiría.
  useEffect(() => {
    if (abierto) {
      setValor('');
      setContrasena('');
      setError(null);
      setEnviando(false);
    }
  }, [abierto]);

  const minimo = campo?.minimo ?? 0;

  const faltaAlgo =
    (pedirContrasena && contrasena.length === 0) ||
    (campo?.requerido && valor.trim().length < Math.max(minimo, 1));

  async function confirmar(evento) {
    evento.preventDefault();
    setError(null);
    setEnviando(true);

    try {
      await onConfirmar({
        valor: campo ? valor.trim() || undefined : undefined,
        contrasena: pedirContrasena ? contrasena : undefined,
      });
      onCerrar();
    } catch (problema) {
      setError(problema.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={(visible) => !visible && !enviando && onCerrar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          {descripcion && <DialogDescription>{descripcion}</DialogDescription>}
        </DialogHeader>

        <form className="flex flex-col gap-5" onSubmit={confirmar}>
          {campo && (
            <CampoFormulario
              id="dato-confirmacion"
              etiqueta={campo.etiqueta}
              ayuda={campo.ayuda}
              requerido={campo.requerido}
            >
              {(props) => (
                <Input
                  {...props}
                  type={campo.tipo ?? 'text'}
                  autoComplete={campo.tipo === 'password' ? 'new-password' : 'off'}
                  autoFocus
                  minLength={minimo || undefined}
                  maxLength={200}
                  value={valor}
                  onChange={(evento) => setValor(evento.target.value)}
                />
              )}
            </CampoFormulario>
          )}

          {pedirContrasena && (
            <CampoFormulario
              id="contrasena-confirmacion"
              etiqueta="Su contraseña"
              ayuda="La misma con la que inicia sesión. Se pide porque esto no se puede deshacer."
              requerido
            >
              {(props) => (
                <Input
                  {...props}
                  type="password"
                  autoComplete="current-password"
                  autoFocus={!campo}
                  required
                  value={contrasena}
                  onChange={(evento) => setContrasena(evento.target.value)}
                />
              )}
            </CampoFormulario>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCerrar} disabled={enviando}>
              Volver
            </Button>
            <Button
              type="submit"
              variant={destructivo ? 'destructive' : 'default'}
              disabled={enviando || faltaAlgo}
            >
              {enviando && <Loader2 className="animate-spin" aria-hidden="true" />}
              {enviando ? 'Un momento...' : textoConfirmar}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default DialogoConfirmacion;
