import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import CategoriasDialog from '@/components/examenes/CategoriasDialog';
import ExamenFormDialog from '@/components/examenes/ExamenFormDialog';
import * as catalogoService from '@/services/catalogo.service';

jest.mock('@/services/catalogo.service');
jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn(), info: jest.fn() },
}));

const SANGRE = {
  id: 3,
  nombre: 'Sangre',
  indicaciones: 'Debe venir con 12 horas de ayuno.',
  total_examenes: 5,
};

beforeEach(() => {
  jest.clearAllMocks();
  catalogoService.listarCategorias.mockResolvedValue([SANGRE]);
});

describe('CategoriasDialog', () => {
  it('lista las categorías con su indicación y cuántos exámenes tienen', async () => {
    render(<CategoriasDialog abierto onCerrar={jest.fn()} />);

    expect(await screen.findByText('Sangre')).toBeInTheDocument();
    expect(screen.getByText('Debe venir con 12 horas de ayuno.')).toBeInTheDocument();
    expect(screen.getByText('5 exámenes')).toBeInTheDocument();
  });

  it('crea una categoría con su indicación', async () => {
    catalogoService.crearCategoria.mockResolvedValue({ id: 4, nombre: 'Orina' });
    const onCambiadas = jest.fn();
    render(<CategoriasDialog abierto onCerrar={jest.fn()} onCambiadas={onCambiadas} />);

    await userEvent.type(screen.getByLabelText(/Nombre/), 'Orina');
    await userEvent.type(screen.getByLabelText(/Indicación/), 'No más de 1 hora en el frasco.');
    await userEvent.click(screen.getByRole('button', { name: /Crear categoría/ }));

    await waitFor(() =>
      expect(catalogoService.crearCategoria).toHaveBeenCalledWith({
        nombre: 'Orina',
        indicaciones: 'No más de 1 hora en el frasco.',
      }),
    );
    expect(onCambiadas).toHaveBeenCalled();
  });

  it('no deja crear una sin nombre', async () => {
    render(<CategoriasDialog abierto onCerrar={jest.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: /Crear categoría/ }));

    expect(await screen.findByText('Escriba el nombre de la categoría.')).toBeInTheDocument();
    expect(catalogoService.crearCategoria).not.toHaveBeenCalled();
  });
});

describe('ExamenFormDialog con categoría', () => {
  it('asigna la categoría elegida al guardar', async () => {
    catalogoService.actualizarExamen.mockResolvedValue({ id: 9 });
    render(
      <ExamenFormDialog
        abierto
        onCerrar={jest.fn()}
        examen={{ id: 9, codigo: 'QUI-001', nombre: 'Glucosa', categoria_id: null }}
      />,
    );

    await userEvent.click(screen.getByLabelText(/Categoría/));
    await userEvent.click(await screen.findByRole('option', { name: 'Sangre' }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() =>
      expect(catalogoService.actualizarExamen).toHaveBeenCalledWith(
        9,
        expect.objectContaining({ categoriaId: 3 }),
      ),
    );
  });
});
