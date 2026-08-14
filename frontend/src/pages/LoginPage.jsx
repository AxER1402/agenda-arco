import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarCheck, ClipboardList, FlaskConical, Loader2, MessageSquare } from 'lucide-react';

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
 * Acceso partido en dos mitades: identidad a la izquierda, formulario a la
 * derecha.
 *
 * El panel de marca se retira por debajo de `lg`: en un teléfono le robaría al
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
        className="hidden w-1/2 flex-col justify-between border-r-2 border-trazo bg-tinta px-12 py-14 text-papel lg:flex xl:w-[55%]"
      >
        <div className="flex items-center gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center bg-primary text-primary-foreground">
            <FlaskConical className="size-7" />
          </span>
          <div className="leading-none">
            <p className="text-xl font-semibold leading-none">El Arco</p>
            <p className="mt-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-agua">
              Laboratorio clínico
            </p>
          </div>
        </div>

        <div className="max-w-lg">
          <p className="text-4xl font-semibold leading-[1.1] xl:text-5xl">
            La agenda del laboratorio, en un solo lugar.
          </p>

          <ul className="mt-10 flex flex-col gap-5">
            {CAPACIDADES.map(({ icono: Icono, texto }) => (
              <li key={texto} className="flex items-center gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center border-2 border-agua/40 text-agua">
                  <Icono className="size-5" />
                </span>
                <span className="text-[0.9375rem] text-agua">{texto}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-agua/70">
          Acceso exclusivo del personal. Las cuentas las crea el administrador.
        </p>
      </section>

      <div className="flex w-full flex-col justify-center px-4 py-12 sm:px-10 lg:w-1/2 xl:w-[45%]">
        <div className="mx-auto w-full max-w-sm">
          {/* La marca solo mientras el panel de la izquierda no está. */}
          <div className="mb-8 flex flex-col items-center text-center lg:hidden">
            <span className="mb-4 flex size-14 items-center justify-center bg-primary text-primary-foreground">
              <FlaskConical className="size-8" aria-hidden="true" />
            </span>
            <p className="text-2xl font-semibold leading-none text-titular">El Arco</p>
            <p className="rotulo mt-2">Laboratorio clínico</p>
          </div>

          <h1 className="text-3xl leading-none">Ingresar</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Use sus credenciales para entrar a la{' '}
            <strong className="font-semibold text-titular">gestión de citas</strong>.
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
