import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarCheck, ClipboardList, Loader2, MessageSquare } from 'lucide-react';

import Logotipo from '@/components/layout/Logotipo';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputContrasena } from '@/components/ui/input-contrasena';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/AuthContext';

/** Lo que el personal viene a hacer aquí, dicho en tres líneas. */
const CAPACIDADES = [
  { icono: CalendarCheck, texto: 'Agenda con el cupo diario bajo control.' },
  { icono: MessageSquare, texto: 'Recordatorios de cita por WhatsApp.' },
  { icono: ClipboardList, texto: 'Órdenes del IGSS con su vigencia al día.' },
];

/**
 * Acceso partido por la mitad: identidad a la izquierda, formulario a la
 * derecha.
 *
 * Las dos mitades son exactamente la mitad —`w-1/2`—, sin la asimetría que
 * tenía antes. El panel de marca es la única superficie honda de todo el
 * sistema: aquí el grafito hace de identidad y, de paso, es lo que deja que el
 * logotipo se vea tal cual se diseñó, sin el filtro que lleva en el resto de la
 * aplicación.
 *
 * El formulario va desnudo sobre el fondo: sin tarjeta, sin borde y sin sombra.
 * En esta pantalla no hay nada más con lo que pueda confundirse, así que un
 * marco alrededor solo añadiría una línea que no separa nada.
 *
 * El panel se retira por debajo de `lg`: en un teléfono le robaría al
 * formulario la pantalla que necesita. Por eso la marca se repite arriba del
 * formulario, visible solo mientras el panel no está.
 */
function LoginPage() {
  const { entrar } = useAuth();
  const navigate = useNavigate();

  const [credenciales, setCredenciales] = useState({ usuario: '', contrasena: '' });
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  function actualizar(campo) {
    return (evento) => setCredenciales((previo) => ({ ...previo, [campo]: evento.target.value }));
  }

  async function manejarEnvio(evento) {
    evento.preventDefault();
    setError(null);
    setEnviando(true);

    try {
      await entrar(credenciales);
      // Siempre al panel: es el resumen del día y el punto de partida del turno.
      navigate('/dashboard', { replace: true });
    } catch (problema) {
      setError(problema.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="flex min-h-screen">
      {/* Mitad de marca. `aria-hidden` porque no dice nada que el formulario no
          diga: repetirlo en un lector de pantalla solo alarga el camino. */}
      <section
        aria-hidden="true"
        className="hidden w-1/2 flex-col justify-between bg-grafito px-12 py-14 text-nieve lg:flex"
      >
        <Logotipo sobreOscuro alt="" className="h-28 max-w-96" />

        <div className="max-w-lg">
          <p className="font-display text-4xl font-normal leading-[1.15] tracking-[-0.02em] xl:text-5xl">
            La agenda del laboratorio, en un solo lugar.
          </p>

          <ul className="mt-10 flex flex-col gap-4">
            {CAPACIDADES.map(({ icono: Icono, texto }) => (
              <li key={texto} className="flex items-center gap-3 text-[0.9375rem] text-nieve/75">
                <Icono className="size-5 shrink-0 text-salvia" />
                {texto}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-nieve/50">
          Acceso exclusivo del personal. Las cuentas las crea el administrador.
        </p>
      </section>

      <div className="flex w-full flex-col justify-center bg-background px-4 py-12 sm:px-10 lg:w-1/2">
        <div className="mx-auto w-full max-w-sm">
          {/* La marca solo mientras el panel de la izquierda no está. */}
          <div className="mb-8 flex justify-center lg:hidden">
            <Logotipo className="h-20 max-w-64" />
          </div>

          <h1 className="text-3xl leading-none">Ingresar</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Use sus credenciales para entrar a la gestión de citas.
          </p>

          <form className="mt-8 flex flex-col gap-5" onSubmit={manejarEnvio} noValidate>
            <div className="flex flex-col gap-2">
              <Label htmlFor="usuario">Usuario</Label>
              <Input
                id="usuario"
                name="usuario"
                autoComplete="username"
                autoFocus
                required
                value={credenciales.usuario}
                onChange={actualizar('usuario')}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="contrasena">Contraseña</Label>
              <InputContrasena
                id="contrasena"
                name="contrasena"
                autoComplete="current-password"
                required
                value={credenciales.contrasena}
                onChange={actualizar('contrasena')}
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" size="lg" disabled={enviando} className="mt-1 w-full">
              {enviando && <Loader2 className="animate-spin" aria-hidden="true" />}
              {enviando ? 'Ingresando...' : 'Ingresar'}
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}

export default LoginPage;
