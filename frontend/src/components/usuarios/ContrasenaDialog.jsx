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
import { InputContrasena } from '@/components/ui/input-contrasena';

/** El mismo mínimo que exige el backend. */
const MINIMO = 8;

/**
 * Alta de una contraseña nueva.
 *
 * Se escribe dos veces y con un botón para verla: la contraseña la teclea aquí
 * quien atiende el mostrador y luego se la dicta a otra persona, así que un
 * error de tecleo no se descubriría hasta que esa persona no pudiera entrar.
 * La repetición avisa en el momento; el botón permite comprobar qué se escribió
 * antes de guardar.
 *
 * `onGuardar` recibe la contraseña y puede lanzar: el mensaje se muestra dentro
 * y el diálogo sigue abierto.
 *
 * @param {object} props
 * @param {boolean} props.abierto
 * @param {() => void} props.onCerrar
 * @param {(contrasena: string) => Promise<void>} props.onGuardar
 * @param {string} props.titulo
 * @param {import('react').ReactNode} [props.descripcion]
 * @param {string} [props.textoGuardar]
 */
function ContrasenaDialog({
  abierto,
  onCerrar,
  onGuardar,
  titulo,
  descripcion,
  textoGuardar = 'Guardar',
}) {
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  // Cada apertura empieza limpia: una contraseña escrita para otra persona no
  // debe quedarse en el campo.
  useEffect(() => {
    if (abierto) {
      setNueva('');
      setRepetida('');
      setError(null);
      setGuardando(false);
    }
  }, [abierto]);

  const cortaDeMas = nueva.length > 0 && nueva.length < MINIMO;
  // Mientras se escribe la repetición no se avisa de nada: solo cuando ya
  // tiene la misma longitud, o más, hay algo que corregir de verdad.
  const noCoinciden = repetida.length >= nueva.length && repetida !== nueva;

  const listo = nueva.length >= MINIMO && repetida === nueva;

  async function guardar(evento) {
    evento.preventDefault();
    setError(null);
    setGuardando(true);

    try {
      await onGuardar(nueva);
      onCerrar();
    } catch (problema) {
      setError(problema.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={(visible) => !visible && !guardando && onCerrar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          {descripcion && <DialogDescription>{descripcion}</DialogDescription>}
        </DialogHeader>

        <form className="flex flex-col gap-5" onSubmit={guardar}>
          <CampoFormulario
            id="contrasena-nueva"
            etiqueta="Contraseña nueva"
            ayuda={`Mínimo ${MINIMO} caracteres.`}
            error={cortaDeMas ? `Debe tener al menos ${MINIMO} caracteres.` : undefined}
            requerido
          >
            {(props) => (
              <InputContrasena
                {...props}
                autoComplete="new-password"
                autoFocus
                maxLength={200}
                value={nueva}
                onChange={(evento) => setNueva(evento.target.value)}
              />
            )}
          </CampoFormulario>

          <CampoFormulario
            id="contrasena-repetida"
            etiqueta="Repita la contraseña"
            ayuda="Debe coincidir con la anterior."
            error={noCoinciden ? 'Las dos contraseñas no coinciden.' : undefined}
            requerido
          >
            {(props) => (
              <InputContrasena
                {...props}
                autoComplete="new-password"
                maxLength={200}
                value={repetida}
                onChange={(evento) => setRepetida(evento.target.value)}
              />
            )}
          </CampoFormulario>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCerrar} disabled={guardando}>
              Volver
            </Button>
            <Button type="submit" disabled={guardando || !listo}>
              {guardando && <Loader2 className="animate-spin" aria-hidden="true" />}
              {guardando ? 'Un momento...' : textoGuardar}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default ContrasenaDialog;
