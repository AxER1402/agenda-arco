import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import AppLayout from '@/components/layout/AppLayout';
import { AuthProvider } from '@/context/AuthContext';
import * as authService from '@/services/auth.service';

jest.mock('@/services/auth.service');

async function renderizarConSesion() {
  authService.obtenerToken.mockReturnValue('token-de-prueba');
  authService.obtenerPerfil.mockResolvedValue({
    id: 1,
    nombre_completo: 'Ana López',
    rol: 'PERSONAL_CITAS',
    rol_nombre: 'Personal de citas',
  });

  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<p>Pantalla de acceso</p>} />
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<p>Panel del día</p>} />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );

  // La sesión se restaura contra el backend antes de pintar el contenido.
  await screen.findByText('Panel del día');
}

/**
 * Salir está en la barra lateral, a un palmo de los enlaces de navegación. Un
 * clic de más devolvía al login en mitad de una gestión, sin preguntar nada.
 */
describe('Cerrar sesión', () => {
  it('no cierra la sesión con solo pulsar el botón', async () => {
    await renderizarConSesion();

    await userEvent.click(screen.getByRole('button', { name: /Salir/ }));

    expect(await screen.findByRole('dialog')).toHaveTextContent('¿Cerrar la sesión?');
    expect(authService.cerrarSesion).not.toHaveBeenCalled();
    expect(screen.getByText('Panel del día')).toBeInTheDocument();
  });

  it('cierra la sesión y va al acceso tras confirmar', async () => {
    await renderizarConSesion();

    await userEvent.click(screen.getByRole('button', { name: /Salir/ }));
    await screen.findByRole('dialog');
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

    await waitFor(() => expect(authService.cerrarSesion).toHaveBeenCalled());
    expect(await screen.findByText('Pantalla de acceso')).toBeInTheDocument();
  });

  it('sigue en la sesión si se vuelve atrás', async () => {
    await renderizarConSesion();

    await userEvent.click(screen.getByRole('button', { name: /Salir/ }));
    await screen.findByRole('dialog');
    await userEvent.click(screen.getByRole('button', { name: 'Volver' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(authService.cerrarSesion).not.toHaveBeenCalled();
    expect(screen.getByText('Panel del día')).toBeInTheDocument();
  });
});
