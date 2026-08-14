import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import EstadoSistemaPage from '@/pages/EstadoSistemaPage';
import { obtenerEstadoSistema } from '@/services/health.service';

// El servicio HTTP se simula: las pruebas de componentes no hacen peticiones.
jest.mock('@/services/health.service');

describe('EstadoSistemaPage', () => {
  it('muestra el nombre del laboratorio', async () => {
    obtenerEstadoSistema.mockResolvedValue({ backend: 'ok', baseDatos: 'ok' });

    render(<EstadoSistemaPage />);

    expect(
      screen.getByRole('heading', { name: /El Arco Laboratorios/i }),
    ).toBeInTheDocument();
    await waitFor(() => expect(obtenerEstadoSistema).toHaveBeenCalled());
  });

  it('marca los servicios en línea cuando el backend responde', async () => {
    obtenerEstadoSistema.mockResolvedValue({ backend: 'ok', baseDatos: 'ok' });

    render(<EstadoSistemaPage />);

    await waitFor(() => {
      expect(screen.getAllByText('En línea')).toHaveLength(2);
    });
  });

  it('marca sin conexión cuando la base de datos no responde', async () => {
    obtenerEstadoSistema.mockResolvedValue({ backend: 'ok', baseDatos: 'error' });

    render(<EstadoSistemaPage />);

    await waitFor(() => {
      expect(screen.getByText('Sin conexión')).toBeInTheDocument();
    });
  });

  it('muestra un aviso accesible si la consulta falla', async () => {
    obtenerEstadoSistema.mockRejectedValue(new Error('No fue posible conectar con el servidor.'));

    render(<EstadoSistemaPage />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'No fue posible conectar con el servidor.',
      );
    });
  });

  it('vuelve a consultar al pulsar el botón', async () => {
    obtenerEstadoSistema.mockResolvedValue({ backend: 'ok', baseDatos: 'ok' });

    render(<EstadoSistemaPage />);

    // El botón muestra "Comprobando..." mientras carga; se espera a que termine.
    const boton = await screen.findByRole('button', { name: /volver a comprobar/i });
    expect(obtenerEstadoSistema).toHaveBeenCalledTimes(1);

    await userEvent.click(boton);

    await waitFor(() => expect(obtenerEstadoSistema).toHaveBeenCalledTimes(2));
  });
});
