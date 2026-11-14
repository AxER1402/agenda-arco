import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import PacienteFormDialog from '@/components/pacientes/PacienteFormDialog';
import * as pacienteService from '@/services/paciente.service';

jest.mock('@/services/paciente.service');
jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn(), info: jest.fn() },
}));

const { toast } = require('sonner');

function renderizar(props = {}) {
  return render(
    <PacienteFormDialog abierto onCerrar={jest.fn()} onGuardado={jest.fn()} {...props} />,
  );
}

describe('PacienteFormDialog', () => {
  it('valida el teléfono en el cliente antes de llamar al backend', async () => {
    renderizar();

    await userEvent.type(screen.getByLabelText(/Nombre completo/), 'Ana López');
    await userEvent.type(screen.getByLabelText(/Teléfono/), '2323232');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(
      await screen.findByText('El teléfono debe ser un número de Guatemala de 8 dígitos.'),
    ).toBeInTheDocument();
    expect(pacienteService.crearPaciente).not.toHaveBeenCalled();
  });

  it.each(['23232323', '55555555'])('acepta el teléfono válido %s', async (telefono) => {
    pacienteService.crearPaciente.mockResolvedValue({ paciente: { id: 1 }, avisos: [] });

    renderizar();

    await userEvent.type(screen.getByLabelText(/Nombre completo/), 'Ana López');
    await userEvent.type(screen.getByLabelText(/Teléfono/), telefono);
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() =>
      expect(pacienteService.crearPaciente).toHaveBeenCalledWith(
        expect.objectContaining({ telefono }),
      ),
    );
  });

  it('exige el nombre completo', async () => {
    renderizar();

    await userEvent.type(screen.getByLabelText(/Teléfono/), '55555555');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('El nombre completo es obligatorio.')).toBeInTheDocument();
  });

  it('muestra el aviso de teléfono repetido que devuelve el backend', async () => {
    pacienteService.crearPaciente.mockResolvedValue({
      paciente: { id: 1 },
      avisos: ['Ya existen 1 paciente(s) registrados con ese teléfono: Carlos Pérez.'],
    });

    renderizar();

    await userEvent.type(screen.getByLabelText(/Nombre completo/), 'Ana Pérez');
    await userEvent.type(screen.getByLabelText(/Teléfono/), '55555555');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() =>
      expect(toast.warning).toHaveBeenCalledWith(
        expect.stringContaining('Carlos Pérez'),
        expect.anything(),
      ),
    );
  });

  it('precarga los datos al editar', () => {
    renderizar({
      paciente: {
        id: 3,
        nombre_completo: 'Carlos Ruiz',
        telefono: '44444444',
        dpi: '1111111111111',
        notas: 'Alergias',
      },
    });

    expect(screen.getByLabelText(/Nombre completo/)).toHaveValue('Carlos Ruiz');
    expect(screen.getByLabelText(/Teléfono/)).toHaveValue('44444444');
    expect(screen.getByLabelText(/DPI/)).toHaveValue('1111111111111');
    expect(screen.getByRole('heading', { name: 'Editar paciente' })).toBeInTheDocument();
  });

  describe('DPI', () => {
    async function llenarObligatorios() {
      await userEvent.type(screen.getByLabelText(/Nombre completo/), 'Ana López');
      await userEvent.type(screen.getByLabelText(/Teléfono/), '55555555');
    }

    it('lo deja pasar vacío, porque es opcional', async () => {
      pacienteService.crearPaciente.mockResolvedValue({ paciente: { id: 1 }, avisos: [] });

      renderizar();
      await llenarObligatorios();
      await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

      await waitFor(() => expect(pacienteService.crearPaciente).toHaveBeenCalled());
    });

    it('rechaza 10 dígitos: le faltan tres', async () => {
      renderizar();
      await llenarObligatorios();
      await userEvent.type(screen.getByLabelText(/DPI/), '1111111111');
      await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

      expect(await screen.findByText('El DPI debe tener 13 dígitos (lleva 10).')).toBeInTheDocument();
      expect(pacienteService.crearPaciente).not.toHaveBeenCalled();
    });

    it('acepta 13 dígitos', async () => {
      pacienteService.crearPaciente.mockResolvedValue({ paciente: { id: 1 }, avisos: [] });

      renderizar();
      await llenarObligatorios();
      await userEvent.type(screen.getByLabelText(/DPI/), '1111111111111');
      await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

      await waitFor(() =>
        expect(pacienteService.crearPaciente).toHaveBeenCalledWith(
          expect.objectContaining({ dpi: '1111111111111' }),
        ),
      );
    });
  });
});
