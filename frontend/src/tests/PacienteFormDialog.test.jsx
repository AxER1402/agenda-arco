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

  describe('beneficiario', () => {
    const PAPA = {
      id: 10,
      nombre_completo: 'PEDRO PEREZ',
      telefono: '55551234',
      tiene_whatsapp: 1,
      titular_id: null,
    };

    it('con un número que ya es de alguien, propone registrarlo como su beneficiario', async () => {
      pacienteService.buscarPorTelefono.mockResolvedValue([PAPA]);
      pacienteService.crearPaciente.mockResolvedValue({ paciente: { id: 11 }, avisos: [] });

      renderizar();

      await userEvent.type(screen.getByLabelText(/Nombre completo/), 'Juan Pérez');
      await userEvent.type(screen.getByLabelText(/Teléfono/), '55551234');

      await waitFor(() =>
        expect(screen.getByLabelText(/¿Es beneficiario\?/)).toHaveTextContent('Sí, de PEDRO PEREZ'),
      );

      await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

      await waitFor(() =>
        expect(pacienteService.crearPaciente).toHaveBeenCalledWith(
          expect.objectContaining({ titularId: 10, telefono: '55551234' }),
        ),
      );
    });

    it('si dicen que no, se registra con el número pero sin vínculo', async () => {
      pacienteService.buscarPorTelefono.mockResolvedValue([PAPA]);
      pacienteService.crearPaciente.mockResolvedValue({ paciente: { id: 11 }, avisos: [] });

      renderizar();

      await userEvent.type(screen.getByLabelText(/Nombre completo/), 'Ana Pérez');
      await userEvent.type(screen.getByLabelText(/Teléfono/), '55551234');
      await waitFor(() =>
        expect(screen.getByLabelText(/¿Es beneficiario\?/)).toHaveTextContent('Sí, de PEDRO PEREZ'),
      );

      await userEvent.click(screen.getByLabelText(/¿Es beneficiario\?/));
      await userEvent.click(screen.getByRole('option', { name: 'No, tiene su propio número' }));
      await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

      await waitFor(() =>
        expect(pacienteService.crearPaciente).toHaveBeenCalledWith(
          expect.objectContaining({ titularId: null }),
        ),
      );
    });

    it('desde «Agregar beneficiario» llega con el número del titular, sin poder cambiarlo', () => {
      renderizar({ titularInicial: PAPA });

      expect(screen.getByRole('heading', { name: 'Agregar beneficiario' })).toBeInTheDocument();
      expect(screen.getByLabelText(/Teléfono/)).toHaveValue('55551234');
      expect(screen.getByLabelText(/Teléfono/)).toHaveAttribute('readonly');
    });

    it('al editar un beneficiario no reenvía el vínculo si no cambió', async () => {
      pacienteService.actualizarPaciente.mockResolvedValue({});

      renderizar({
        paciente: {
          id: 11,
          nombre_completo: 'JUAN PEREZ',
          telefono: '55551234',
          titular_id: 10,
          titular_nombre: 'PEDRO PEREZ',
          tiene_whatsapp: 1,
        },
      });

      expect(screen.getByLabelText(/Teléfono/)).toHaveAttribute('readonly');
      await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

      await waitFor(() => expect(pacienteService.actualizarPaciente).toHaveBeenCalled());
      expect(pacienteService.actualizarPaciente.mock.calls[0][1]).not.toHaveProperty('titularId');
    });
  });
});
