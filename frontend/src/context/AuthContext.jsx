import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import * as authService from '@/services/auth.service';

const AuthContext = createContext(null);

/**
 * Estado de sesión de la aplicación.
 *
 * Al cargar la página se valida contra el backend el token guardado: un token
 * puede haber vencido o el usuario haber sido desactivado desde la última vez.
 */
export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let cancelado = false;

    async function restaurarSesion() {
      if (!authService.obtenerToken()) {
        setCargando(false);
        return;
      }

      try {
        const perfil = await authService.obtenerPerfil();
        if (!cancelado) setUsuario(perfil);
      } catch {
        authService.cerrarSesion();
      } finally {
        if (!cancelado) setCargando(false);
      }
    }

    restaurarSesion();
    return () => {
      cancelado = true;
    };
  }, []);

  const entrar = useCallback(async (credenciales) => {
    const autenticado = await authService.iniciarSesion(credenciales);
    setUsuario(autenticado);
    return autenticado;
  }, []);

  const salir = useCallback(() => {
    authService.cerrarSesion();
    setUsuario(null);
  }, []);

  const valor = useMemo(
    () => ({
      usuario,
      cargando,
      autenticado: Boolean(usuario),
      esAdministrador: usuario?.rol === 'ADMINISTRADOR',
      entrar,
      salir,
    }),
    [usuario, cargando, entrar, salir],
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const contexto = useContext(AuthContext);

  if (!contexto) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider.');
  }

  return contexto;
}
