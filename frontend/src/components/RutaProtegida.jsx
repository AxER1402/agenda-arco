import { Navigate, Outlet } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import { useAuth } from '@/context/AuthContext';

/**
 * Puerta de entrada a las rutas privadas.
 *
 * Es una comodidad de la interfaz, no una medida de seguridad: quien controla
 * el navegador puede saltársela. La protección real está en el backend, que
 * exige el token y el rol en cada endpoint.
 */
function RutaProtegida({ rolesPermitidos }) {
  const { autenticado, cargando, usuario } = useAuth();

  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center" role="status">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">Verificando sesión...</span>
      </div>
    );
  }

  if (!autenticado) {
    // No se recuerda a dónde iba: al entrar se empieza siempre por el panel.
    return <Navigate to="/login" replace />;
  }

  if (rolesPermitidos && !rolesPermitidos.includes(usuario.rol)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

export default RutaProtegida;
