import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  ClipboardList,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Users,
  UserCog,
  X,
} from 'lucide-react';

import DialogoConfirmacion from '@/components/DialogoConfirmacion';
import RelojEncabezado from '@/components/layout/RelojEncabezado';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

const ENLACES = [
  { a: '/dashboard', texto: 'Panel', icono: LayoutDashboard },
  { a: '/citas', texto: 'Citas', icono: ClipboardList },
  { a: '/agenda', texto: 'Agenda', icono: CalendarDays },
  { a: '/pacientes', texto: 'Pacientes', icono: Users },
  { a: '/examenes', texto: 'Exámenes', icono: FlaskConical },
  { a: '/usuarios', texto: 'Usuarios', icono: UserCog, soloAdministrador: true },
  { a: '/configuracion', texto: 'Configuración', icono: Settings, soloAdministrador: true },
];

/**
 * Estructura de dos columnas: barra lateral fija y contenido.
 *
 * A partir de `lg` la barra es una columna permanente del documento. Por debajo
 * se convierte en un cajón que entra desde la izquierda sobre un velo, con la
 * barra superior reducida a marca y botón de menú. Es el mismo marcado en los
 * dos casos —un solo `<nav>`, un solo juego de enlaces— para que no haya dos
 * navegaciones que mantener sincronizadas.
 *
 * La barra va en tinta —uno de los dos únicos sitios donde queda ese morado,
 * junto al panel de acceso— y el contenido sobre blanco; lo que separa las dos
 * columnas, y la barra superior del trabajo, es el trazo negro de 2 px.
 */
function AppLayout() {
  const { usuario, esAdministrador, salir } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [menuAbierto, setMenuAbierto] = useState(false);
  const [confirmandoSalida, setConfirmandoSalida] = useState(false);
  const botonMenu = useRef(null);
  const cajon = useRef(null);

  const enlaces = ENLACES.filter((enlace) => !enlace.soloAdministrador || esAdministrador);

  // Navegar cierra el cajón: en móvil el destino queda tapado si sigue abierto.
  useEffect(() => {
    setMenuAbierto(false);
  }, [location.pathname]);

  // Con el cajón abierto: Escape lo cierra, el foco entra en él y el fondo no
  // se desplaza detrás del velo.
  useEffect(() => {
    if (!menuAbierto) return undefined;

    function alPulsarTecla(evento) {
      if (evento.key === 'Escape') {
        setMenuAbierto(false);
        botonMenu.current?.focus();
      }
    }

    const desbordePrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', alPulsarTecla);
    cajon.current?.focus();

    return () => {
      document.body.style.overflow = desbordePrevio;
      document.removeEventListener('keydown', alPulsarTecla);
    };
  }, [menuAbierto]);

  /**
   * Salir se confirma: en el mostrador el botón queda a un palmo de los enlaces
   * de navegación, y un clic de más devolvía al login en mitad de una gestión.
   */
  async function cerrarSesion() {
    salir();
    navigate('/login', { replace: true });
  }

  const iniciales = (usuario?.nombre_completo ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((palabra) => palabra[0].toUpperCase())
    .join('');

  return (
    <div className="flex min-h-screen">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:border-2 focus:border-trazo focus:bg-primary focus:px-4 focus:py-2 focus:font-semibold focus:text-primary-foreground"
      >
        Saltar al contenido
      </a>

      {/* Velo del cajón. Solo existe por debajo de lg. */}
      {menuAbierto && (
        <div
          className="fixed inset-0 z-40 bg-negro/60 lg:hidden"
          onClick={() => setMenuAbierto(false)}
          aria-hidden="true"
        />
      )}

      <aside
        id="menu-lateral"
        ref={cajon}
        tabIndex={-1}
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r-2 border-trazo',
          'bg-barra text-barra-foreground',
          'transition-transform duration-200 ease-out focus:outline-none',
          'lg:sticky lg:top-0 lg:bottom-auto lg:z-auto lg:h-screen lg:w-64 lg:shrink-0 lg:translate-x-0',
          menuAbierto ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between gap-2 border-barra-linea px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center border-2 border-papel bg-primary text-primary-foreground">
              <FlaskConical className="size-5" aria-hidden="true" />
            </span>
            <div className="leading-none">
              <p className="text-base font-semibold leading-none text-barra-foreground">
                El Arco
              </p>
              <p className="rotulo mt-1 text-barra-suave">Laboratorios</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setMenuAbierto(false)}
            className="flex size-9 items-center justify-center text-barra-suave transition-colors duration-100 hover:bg-barra-linea hover:text-barra-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-barra-suave focus-visible:ring-offset-2 focus-visible:ring-offset-barra lg:hidden"
          >
            <X className="size-4" aria-hidden="true" />
            <span className="sr-only">Cerrar menú</span>
          </button>
        </div>

        {/* La lista crece y hace scroll propio: con seis secciones no hace
            falta hoy, pero evita que el bloque de usuario se salga si crece. */}
        <nav aria-label="Principal" className="flex-1 overflow-y-auto py-3">
          <ul className="flex flex-col">
            {enlaces.map(({ a, texto, icono: Icono }) => (
              <li key={a}>
                <NavLink
                  to={a}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 border-l-2 px-4 py-3 text-sm font-semibold transition-colors duration-100',
                      isActive
                        ? 'border-papel bg-primary text-primary-foreground'
                        : 'border-transparent text-barra-suave hover:bg-barra-linea hover:text-barra-foreground',
                    )
                  }
                >
                  <Icono className="size-4 shrink-0" aria-hidden="true" />
                  {texto}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t-2 border-barra-linea p-4">
          <div className="mb-3 flex items-center gap-3">
            <span
              className="flex size-10 shrink-0 items-center justify-center bg-agua text-sm font-semibold text-negro"
              aria-hidden="true"
            >
              {iniciales}
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-semibold text-barra-foreground">
                {usuario?.nombre_completo}
              </p>
              <p className="rotulo truncate text-barra-suave">
                {usuario?.rol_nombre ?? usuario?.rol}
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmandoSalida(true)}
            className="w-full border-barra-suave bg-transparent text-barra-foreground hover:bg-papel hover:text-negro"
          >
            <LogOut aria-hidden="true" />
            Salir
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra superior. La marca y el botón de menú solo hacen falta mientras
            la lateral está plegada; el reloj acompaña a todas las vistas. */}
        <div className="sticky top-0 z-30 flex items-center gap-3 border-b-2 border-trazo bg-card px-3 py-3 sm:px-6">
          <div className="flex items-center gap-2.5 lg:hidden">
            <span className="flex size-9 shrink-0 items-center justify-center border-2 border-trazo bg-primary text-primary-foreground">
              <FlaskConical className="size-4" aria-hidden="true" />
            </span>
            <p className="text-base font-semibold leading-none text-titular">El Arco</p>
          </div>

          <RelojEncabezado className="ml-auto" />

          <button
            type="button"
            ref={botonMenu}
            onClick={() => setMenuAbierto(true)}
            aria-expanded={menuAbierto}
            aria-controls="menu-lateral"
            className="flex items-center gap-2 border-2 border-trazo bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors duration-100 hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 lg:hidden"
          >
            <Menu className="size-4" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">Menú</span>
          </button>
        </div>

        {/* El aire vertical se mantiene; el lateral se recorta para que las
            tablas anchas no queden encajonadas en medio de la pantalla. */}
        <main id="contenido" className="flex-1 bg-lienzo px-3 py-8 sm:px-6 sm:py-10">
          <div className="mx-auto w-full max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>

      <DialogoConfirmacion
        abierto={confirmandoSalida}
        onCerrar={() => setConfirmandoSalida(false)}
        onConfirmar={cerrarSesion}
        titulo="¿Cerrar la sesión?"
        descripcion="Volverá a la pantalla de acceso y tendrá que escribir su usuario y contraseña para entrar de nuevo."
        textoConfirmar="Cerrar sesión"
      />
    </div>
  );
}

export default AppLayout;
