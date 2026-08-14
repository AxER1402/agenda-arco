import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import MensajeRecordatorioCard from '@/components/configuracion/MensajeRecordatorioCard';
import {
  guardarPlantilla,
  obtenerPlantilla,
  previsualizarPlantilla,
} from '@/services/recordatorio.service';

// El servicio HTTP se simula: las pruebas de componentes no hacen peticiones.
jest.mock('@/services/recordatorio.service');

const IMAGEN = 'data:image/png;base64,iVBORw0KGgo=';

const PLANTILLA = 'Estimado(a) {paciente}:\nSu cita es el {fecha}.';

function datosDePrueba(cambios = {}) {
  return {
    plantilla: PLANTILLA,
    imagen: null,
    marcadores: {
      paciente: 'Nombre del paciente.',
      fecha: 'Fecha de la cita (DD/MM/AAAA).',
    },
    por_defecto: 'Plantilla original del sistema.',
    ejemplo: 'Estimado(a) María González:\nSu cita es el 12/08/2026.',
    ...cambios,
  };
}

/**
 * Monta la tarjeta y espera a que llegue lo que hay guardado: el texto se carga
 * del backend, y escribir antes de que llegue lo sobrescribiría.
 * @returns {Promise<HTMLTextAreaElement>} el área de texto ya cargada.
 */
async function renderizarCargado() {
  render(<MensajeRecordatorioCard />);

  await screen.findByText(/María González/);
  return screen.getByLabelText('Texto');
}

describe('MensajeRecordatorioCard', () => {
  beforeEach(() => {
    obtenerPlantilla.mockResolvedValue(datosDePrueba());
    previsualizarPlantilla.mockResolvedValue({ mensaje: 'Vista previa nueva.' });
    guardarPlantilla.mockImplementation(async ({ plantilla, imagen }) =>
      datosDePrueba({ plantilla, imagen: imagen || null, ejemplo: 'Guardado.' }),
    );
  });

  it('carga el mensaje guardado y su ejemplo', async () => {
    const area = await renderizarCargado();

    expect(area).toHaveValue(PLANTILLA);
    expect(screen.getByText(/Estimado\(a\) María González/)).toBeInTheDocument();
  });

  /** El usuario no tiene por qué recordar cómo se escriben los datos. */
  it('inserta un dato en el texto al pulsar su botón', async () => {
    const area = await renderizarCargado();

    await userEvent.clear(area);
    await userEvent.click(screen.getByRole('button', { name: '{paciente}' }));

    expect(area).toHaveValue('{paciente}');
  });

  it('pide la vista previa al backend cuando se deja de escribir', async () => {
    const area = await renderizarCargado();

    await userEvent.clear(area);
    await userEvent.type(area, 'Hola');

    await waitFor(() => expect(previsualizarPlantilla).toHaveBeenCalledWith('Hola'));
    expect(await screen.findByText('Vista previa nueva.')).toBeInTheDocument();
  });

  it('guarda el texto junto con la imagen', async () => {
    obtenerPlantilla.mockResolvedValue(datosDePrueba({ imagen: IMAGEN }));

    await renderizarCargado();
    await userEvent.click(screen.getByRole('button', { name: /guardar mensaje/i }));

    await waitFor(() =>
      expect(guardarPlantilla).toHaveBeenCalledWith({ plantilla: PLANTILLA, imagen: IMAGEN }),
    );
  });

  /** Mandar la imagen vacía es la forma de pedir que se quite. */
  it('quitar la imagen la guarda como vacía', async () => {
    obtenerPlantilla.mockResolvedValue(datosDePrueba({ imagen: IMAGEN }));

    await renderizarCargado();
    await userEvent.click(screen.getByRole('button', { name: /quitar imagen/i }));
    await userEvent.click(screen.getByRole('button', { name: /guardar mensaje/i }));

    await waitFor(() =>
      expect(guardarPlantilla).toHaveBeenCalledWith({ plantilla: PLANTILLA, imagen: '' }),
    );
  });

  it('no ofrece quitar la imagen si no hay ninguna', async () => {
    await renderizarCargado();

    expect(screen.getByRole('button', { name: /elegir imagen/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /quitar imagen/i })).not.toBeInTheDocument();
  });

  it('no deja guardar un mensaje vacío', async () => {
    const area = await renderizarCargado();

    await userEvent.clear(area);

    expect(screen.getByRole('button', { name: /guardar mensaje/i })).toBeDisabled();
  });

  it('permite recuperar el texto original del sistema', async () => {
    const area = await renderizarCargado();

    await userEvent.click(screen.getByRole('button', { name: /texto original/i }));

    expect(area).toHaveValue('Plantilla original del sistema.');
  });
});
