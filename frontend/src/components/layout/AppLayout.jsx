import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  ClipboardList,
  FileText,
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
import Logotipo from '@/components/layout/Logotipo';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

const ENLACES = [
  { a: '/dashboard', texto: 'Panel', icono: LayoutDashboard },
  { a: '/citas', texto: 'Citas', icono: ClipboardList },
  { a: '/agenda', texto: 'Agenda', icono: CalendarDays },
  { a: '/pacientes', texto: 'Pacientes', icono: Users },
  { a: '/examenes', texto: 'Exámenes', icono: FlaskConical },
  { a: '/reportes', texto: 'Reportes', icono: FileText },
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
 * La barra va en pizarra macizo: es el único bloque de color pleno de toda la
 * aplicación y lo que sostiene la pantalla. El contenido va en blanco sobre el
 * lienzo gris, y las tarjetas se recortan contra él por el borde, no por flotar.
 *
 * Sobre el pizarra, el logotipo va sin el filtro que lleva en el resto del
 * sistema: ahí sí tiene la superficie oscura para la que se diseñó. En la franja
 * superior —que es clara— sigue filtrado.
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
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-sm"
      >
        Saltar al contenido
      </a>

      {/* Velo del cajón. Solo existe por debajo de lg. */}
      {menuAbierto && (
        <div
          className="velo fixed inset-0 z-40 lg:hidden"
          onClick={() => setMenuAbierto(false)}
          aria-hidden="true"
        />
      )}

      <aside
        id="menu-lateral"
        ref={cajon}
        tabIndex={-1}
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 flex-col',
          'border-r border-sidebar-border bg-sidebar text-sidebar-foreground',
          'transition-transform duration-200 ease-out focus:outline-none',
          'lg:sticky lg:top-0 lg:bottom-auto lg:z-auto lg:h-screen lg:w-64 lg:shrink-0 lg:translate-x-0',
          menuAbierto ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* El logotipo va centrado en la columna. El botón de cerrar se sale del
            flujo y se ancla a la derecha: si ocupara sitio, el logotipo
            quedaría centrado respecto al hueco que le deja y no respecto a la
            barra, y se vería descuadrado en cuanto el menú se abre en móvil. */}
        <div className="relative flex items-center justify-center px-4 py-4">
          <Logotipo sobreOscuro className="h-16 max-w-full" />

          <button
            type="button"
            onClick={() => setMenuAbierto(false)}
            className="absolute right-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-sidebar-muted outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 lg:hidden"
          >
            <X className="size-4" aria-hidden="true" />
            <span className="sr-only">Cerrar menú</span>
          </button>
        </div>

        {/* La lista crece y hace scroll propio: con seis secciones no hace falta
            hoy, pero evita que el bloque de usuario se salga si crece. */}
        <nav aria-label="Principal" className="flex-1 overflow-y-auto px-2.5 py-3">
          <ul className="flex flex-col gap-0.5">
            {enlaces.map(({ a, texto, icono: Icono }) => (
              <li key={a}>
                {/* La sección abierta es uno de los sitios donde sale el color
                    de marca. Sobre el pizarra el jade se apaga, así que aquí el
                    acento sube al salvia claro. */}
                <NavLink
                  to={a}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium outline-none transition-colors',
                      'focus-visible:ring-[3px] focus-visible:ring-ring/50',
                      isActive
                        ? 'bg-sidebar-activo text-sidebar-activo-foreground'
                        : 'text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground',
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

        <div className="border-t border-sidebar-border p-4">
          <div className="mb-3 flex items-center gap-3">
            <span
              className="flex size-9 shrink-0 items-center justify-center bg-sidebar-accent text-xs font-medium text-sidebar-foreground"
              aria-hidden="true"
            >
              {iniciales}
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-medium text-sidebar-foreground">
                {usuario?.nombre_completo}
              </p>
              <p className="truncate text-xs text-sidebar-muted">
                {usuario?.rol_nombre ?? usuario?.rol}
              </p>
            </div>
          </div>

          {/* El `outline` del sistema lleva fondo blanco y sobre el pizarra se
              vería como un parche. Se le da el mismo gesto con los tonos de la
              barra: contorno de un pelo y relleno solo al pasar por encima. */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmandoSalida(true)}
            className="w-full border border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <LogOut aria-hidden="true" />
            Salir
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra superior. La marca y el botón de menú solo hacen falta mientras
            la lateral está plegada; el reloj acompaña a todas las vistas. */}
        {/* La barra superior es una franja, no un bloque: lo justo para el reloj
            y, en móvil, la marca y el botón de menú. Va en el gris del lienzo,
            un punto más honda, y no en el pizarra de la barra lateral: en móvil
            lleva el logotipo, y ahí va filtrado para fondo claro. */}
        <div className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-franja-borde bg-franja px-3 sm:px-6">
          <Logotipo className="h-7 max-w-32 lg:hidden" />

          <RelojEncabezado className="ml-auto" />

          <button
            type="button"
            ref={botonMenu}
            onClick={() => setMenuAbierto(true)}
            aria-expanded={menuAbierto}
            aria-controls="menu-lateral"
            className="flex h-8 items-center gap-2 rounded-md border bg-background px-2.5 text-sm shadow-xs outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 lg:hidden"
          >
            <Menu className="size-4" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">Menú</span>
          </button>
        </div>

        {/* El aire vertical se mantiene; el lateral se recorta para que las
            tablas anchas no queden encajonadas en medio de la pantalla. */}
        <main id="contenido" className="flex-1 px-3 py-8 sm:px-6 sm:py-10">
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
