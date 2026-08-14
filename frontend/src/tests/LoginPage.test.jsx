import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import LoginPage from '@/pages/LoginPage';
import { AuthProvider } from '@/context/AuthContext';
import * as authService from '@/services/auth.service';

jest.mock('@/services/auth.service');

function renderizarLogin({ entradas = ['/login'] } = {}) {
  return render(
    <MemoryRouter initialEntries={entradas}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<p>Panel del día</p>} />
          <Route path="/pacientes" element={<p>Pacientes</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

async function entrar() {
  await userEvent.type(screen.getByLabelText('Usuario'), 'ana.lopez');
  await userEvent.type(screen.getByLabelText('Contraseña'), 'Laboratorio2026');
  await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
}

describe('LoginPage', () => {
  beforeEach(() => {
    authService.obtenerToken.mockReturnValue(null);
  });

  it('muestra los campos de usuario y contraseña', () => {
    renderizarLogin();

    expect(screen.getByLabelText('Usuario')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeInTheDocument();
  });

  /**
   * El panel de marca de la izquierda es decorativo: repite lo que ya dice el
   * formulario. Si entrara en el árbol de accesibilidad, quien use un lector de
   * pantalla tendría que atravesarlo entero antes de llegar a los campos.
   */
  it('no anuncia el panel de marca al lector de pantalla', () => {
    renderizarLogin();

    const encabezados = screen.getAllByRole('heading');

    expect(encabezados).toHaveLength(1);
    expect(encabezados[0]).toHaveTextContent('Ingresar');
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('oculta la contraseña mientras se escribe', () => {
    renderizarLogin();

    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'password');
  });

  /**
   * Con el texto oculto, un error de tecleo solo se descubre cuando el acceso ya
   * ha fallado. El botón permite comprobarlo antes de enviar.
   */
  describe('Ver la contraseña', () => {
    it('la muestra y la vuelve a ocultar', async () => {
      renderizarLogin();

      const campo = screen.getByLabelText('Contraseña');
      await userEvent.type(campo, 'Laboratorio2026');

      await userEvent.click(screen.getByRole('button', { name: 'Ver la contraseña' }));
      expect(campo).toHaveAttribute('type', 'text');
      expect(campo).toHaveValue('Laboratorio2026');

      await userEvent.click(screen.getByRole('button', { name: 'Ocultar la contraseña' }));
      expect(campo).toHaveAttribute('type', 'password');
    });

    /** Mostrarla no puede enviar el formulario a medio escribir. */
    it('no envía el formulario', async () => {
      renderizarLogin();

      await userEvent.click(screen.getByRole('button', { name: 'Ver la contraseña' }));

      expect(authService.iniciarSesion).not.toHaveBeenCalled();
    });
  });

  it('envía las credenciales al servicio de autenticación', async () => {
    authService.iniciarSesion.mockResolvedValue({
      nombre_completo: 'Ana López',
      rol: 'PERSONAL_CITAS',
    });

    renderizarLogin();
    await entrar();

    await waitFor(() =>
      expect(authService.iniciarSesion).toHaveBeenCalledWith({
        usuario: 'ana.lopez',
        contrasena: 'Laboratorio2026',
      }),
    );
  });

  /**
   * Entrar lleva siempre al panel, que es el resumen del día. Antes se volvía a
   * la pantalla desde la que había saltado la sesión caducada, y el turno
   * empezaba en medio de cualquier sitio.
   */
  it('lleva al panel después de entrar', async () => {
    authService.iniciarSesion.mockResolvedValue({
      nombre_completo: 'Ana López',
      rol: 'PERSONAL_CITAS',
    });

    renderizarLogin();
    await entrar();

    expect(await screen.findByText('Panel del día')).toBeInTheDocument();
  });

  it('lleva al panel aunque se llegara al login desde otra pantalla', async () => {
    authService.iniciarSesion.mockResolvedValue({
      nombre_completo: 'Ana López',
      rol: 'PERSONAL_CITAS',
    });

    renderizarLogin({ entradas: ['/pacientes', '/login'] });
    await entrar();

    expect(await screen.findByText('Panel del día')).toBeInTheDocument();
    expect(screen.queryByText('Pacientes')).not.toBeInTheDocument();
  });

  it('muestra el mensaje de error que devuelve el backend', async () => {
    authService.iniciarSesion.mockRejectedValue(new Error('Usuario o contraseña incorrectos.'));

    renderizarLogin();
    await entrar();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Usuario o contraseña incorrectos.',
    );
  });

  it('vuelve a habilitar el botón tras un intento fallido', async () => {
    authService.iniciarSesion.mockRejectedValue(new Error('Usuario o contraseña incorrectos.'));

    renderizarLogin();
    await entrar();

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Ingresar' })).toBeEnabled(),
    );
  });
});
