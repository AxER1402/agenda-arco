import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import RutaProtegida from '@/components/RutaProtegida';
import { AuthProvider } from '@/context/AuthContext';
import * as authService from '@/services/auth.service';

jest.mock('@/services/auth.service');

function renderizarRutas({ rolesPermitidos } = {}) {
  return render(
    <MemoryRouter initialEntries={['/privado']}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<p>Pantalla de acceso</p>} />
          <Route path="/dashboard" element={<p>Panel</p>} />
          <Route element={<RutaProtegida rolesPermitidos={rolesPermitidos} />}>
            <Route path="/privado" element={<p>Contenido privado</p>} />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('RutaProtegida', () => {
  it('redirige al login cuando no hay sesión', async () => {
    authService.obtenerToken.mockReturnValue(null);

    renderizarRutas();

    expect(await screen.findByText('Pantalla de acceso')).toBeInTheDocument();
  });

  it('muestra el contenido cuando el token es válido', async () => {
    authService.obtenerToken.mockReturnValue('token-de-prueba');
    authService.obtenerPerfil.mockResolvedValue({
      nombre_completo: 'Ana López',
      rol: 'PERSONAL_CITAS',
    });

    renderizarRutas();

    expect(await screen.findByText('Contenido privado')).toBeInTheDocument();
  });

  it('redirige al login si el token guardado ya no sirve', async () => {
    authService.obtenerToken.mockReturnValue('token-vencido');
    authService.obtenerPerfil.mockRejectedValue(new Error('Su sesión expiró.'));

    renderizarRutas();

    expect(await screen.findByText('Pantalla de acceso')).toBeInTheDocument();
    expect(authService.cerrarSesion).toHaveBeenCalled();
  });

  it('desvía al panel si el rol no tiene permiso', async () => {
    authService.obtenerToken.mockReturnValue('token-de-prueba');
    authService.obtenerPerfil.mockResolvedValue({
      nombre_completo: 'Ana López',
      rol: 'PERSONAL_CITAS',
    });

    renderizarRutas({ rolesPermitidos: ['ADMINISTRADOR'] });

    expect(await screen.findByText('Panel')).toBeInTheDocument();
  });
});
