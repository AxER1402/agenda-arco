import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import RecepcionCitaDialog from '@/components/citas/RecepcionCitaDialog';
import * as citaService from '@/services/cita.service';
import * as catalogoService from '@/services/catalogo.service';
import * as pacienteService from '@/services/paciente.service';

jest.mock('@/services/cita.service');
jest.mock('@/services/catalogo.service');
jest.mock('@/services/paciente.service');
jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn(), info: jest.fn() },
}));

const PACIENTE = {
  id: 1,
  nombre_completo: 'Ana López',
  telefono: '55512345',
  dpi: '1111111111111',
};

const EXAMENES = [
  { id: 1, codigo: 'HEM-001', nombre: 'Hematología completa' },
  { id: 2, codigo: 'QUI-001', nombre: 'Glucosa' },
];

// Recibida el 11/08 → vence el 11/11, y se propone lo más cerca del vencimiento.
const VENCIMIENTO = {
  fecha_entrega: '2026-08-11',
  fecha_vencimiento: '2026-11-11',
  meses_vigencia: 3,
  vencida: false,
  fechas_sugeridas: [
    { fecha: '2026-11-11', disponibles: 40 },
    { fecha: '2026-11-10', disponibles: 12 },
  ],
};

function renderizar(props = {}) {
  return render(
    <RecepcionCitaDialog abierto onCerrar={jest.fn()} onGuardada={jest.fn()} {...props} />,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  catalogoService.listarExamenes.mockResolvedValue(EXAMENES);
  catalogoService.calcularVencimiento.mockResolvedValue(VENCIMIENTO);
  citaService.consultarDisponibilidad.mockResolvedValue({
    laborable: true,
    limite: 40,
    disponibles: 30,
  });
  citaService.recibirPaciente.mockResolvedValue({
    cita: { id: 10 },
    paciente_registrado: false,
    avisos: [],
  });
  pacienteService.buscarPorTelefono.mockResolvedValue([]);
});

describe('Identificación por teléfono', () => {
  it('rellena el nombre cuando el número ya está registrado', async () => {
    pacienteService.buscarPorTelefono.mockResolvedValue([PACIENTE]);

    renderizar();

    await userEvent.type(screen.getByLabelText(/Teléfono/), '55512345');

    expect(await screen.findByText('Ana López')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByLabelText(/Nombre completo/)).toHaveValue('Ana López'),
    );
  });

  it('avisa de que es un paciente nuevo cuando nadie usa el número', async () => {
    renderizar();

    await userEvent.type(screen.getByLabelText(/Teléfono/), '55599999');

    expect(await screen.findByText(/se registrará como paciente nuevo/)).toBeInTheDocument();
    // Y pide el DPI, que solo tiene sentido al registrar a alguien.
    expect(screen.getByLabelText(/DPI/)).toBeInTheDocument();
  });

  it('deja elegir cuando varios pacientes comparten el número', async () => {
    pacienteService.buscarPorTelefono.mockResolvedValue([
      PACIENTE,
      { id: 2, nombre_completo: 'Carlos López', telefono: '55512345' },
    ]);

    renderizar();

    await userEvent.type(screen.getByLabelText(/Teléfono/), '55512345');

    expect(await screen.findByText(/Hay 2 pacientes con ese teléfono/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Carlos López' }));

    expect(screen.getByLabelText(/Nombre completo/)).toHaveValue('Carlos López');
  });
});

describe('Orden del IGSS dentro de la cita', () => {
  it('muestra hasta qué día se puede recibir según la fecha de recepción', async () => {
    renderizar();

    // La fecha sale dos veces: en el aviso de vigencia y como fecha propuesta.
    const aviso = await screen.findByText(/Se puede recibir hasta el/);

    expect(aviso).toHaveTextContent('11/11/2026');
    expect(aviso).toHaveTextContent('Ese mismo día todavía vale; el siguiente ya no.');
  });

  it('propone la fecha con cupo más cercana al vencimiento', async () => {
    renderizar();

    await waitFor(() =>
      expect(screen.getByLabelText(/Fecha de la cita/)).toHaveValue('2026-11-11'),
    );
  });

  it('limita el selector de fecha al vencimiento', async () => {
    renderizar();

    await waitFor(() =>
      expect(screen.getByLabelText(/Fecha de la cita/)).toHaveAttribute('max', '2026-11-11'),
    );
  });

  it('impide agendar si la orden ya venció', async () => {
    catalogoService.calcularVencimiento.mockResolvedValue({
      ...VENCIMIENTO,
      vencida: true,
      fechas_sugeridas: [],
    });

    renderizar();

    expect(await screen.findByText(/necesita una orden nueva/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Programar cita' })).toBeDisabled();
  });
});

describe('Envío', () => {
  async function llenarFormulario() {
    await userEvent.type(screen.getByLabelText(/Teléfono/), '55599999');
    await screen.findByText(/se registrará como paciente nuevo/);

    await userEvent.type(screen.getByLabelText(/Nombre completo/), 'Marta Ruiz');
    await userEvent.click(screen.getByRole('checkbox', { name: /Hematología completa/ }));
    await userEvent.type(screen.getByLabelText(/^Hora/), '09:00');
  }

  it('registra paciente, orden y cita en una sola llamada', async () => {
    citaService.recibirPaciente.mockResolvedValue({
      cita: { id: 10 },
      paciente_registrado: true,
      avisos: [],
    });

    renderizar();
    await screen.findByText(/Se puede recibir hasta el/);
    await llenarFormulario();

    await userEvent.click(screen.getByRole('button', { name: 'Programar cita' }));

    await waitFor(() =>
      expect(citaService.recibirPaciente).toHaveBeenCalledWith(
        expect.objectContaining({
          paciente: expect.objectContaining({
            nombreCompleto: 'Marta Ruiz',
            telefono: '55599999',
          }),
          examenes: [1],
          fecha: '2026-11-11',
          hora: '09:00',
        }),
      ),
    );
  });

  it('envía el identificador cuando el paciente ya existía', async () => {
    pacienteService.buscarPorTelefono.mockResolvedValue([PACIENTE]);

    renderizar();
    await screen.findByText(/Se puede recibir hasta el/);

    await userEvent.type(screen.getByLabelText(/Teléfono/), '55512345');
    await screen.findByText('Ana López');

    await userEvent.click(screen.getByRole('checkbox', { name: /Glucosa/ }));
    await userEvent.type(screen.getByLabelText(/^Hora/), '10:30');
    await userEvent.click(screen.getByRole('button', { name: 'Programar cita' }));

    await waitFor(() =>
      expect(citaService.recibirPaciente).toHaveBeenCalledWith(
        expect.objectContaining({ pacienteId: 1, examenes: [2] }),
      ),
    );
    expect(citaService.recibirPaciente.mock.calls[0][0].paciente).toBeUndefined();
  });

  it('exige al menos un examen', async () => {
    renderizar();
    await screen.findByText(/Se puede recibir hasta el/);

    await userEvent.type(screen.getByLabelText(/Teléfono/), '55599999');
    await userEvent.type(screen.getByLabelText(/Nombre completo/), 'Marta Ruiz');
    await userEvent.type(screen.getByLabelText(/^Hora/), '09:00');
    await userEvent.click(screen.getByRole('button', { name: 'Programar cita' }));

    expect(await screen.findByText('Indique al menos un examen.')).toBeInTheDocument();
    expect(citaService.recibirPaciente).not.toHaveBeenCalled();
  });

  it('rechaza un DPI incompleto antes de llamar al backend', async () => {
    renderizar();
    await screen.findByText(/Se puede recibir hasta el/);

    await llenarFormulario();
    await userEvent.type(screen.getByLabelText(/DPI/), '1111111111');
    await userEvent.click(screen.getByRole('button', { name: 'Programar cita' }));

    expect(await screen.findByText(/El DPI debe tener 13 dígitos \(lleva 10\)/)).toBeInTheDocument();
    expect(citaService.recibirPaciente).not.toHaveBeenCalled();
  });

  it('acepta un DPI de 13 dígitos', async () => {
    renderizar();
    await screen.findByText(/Se puede recibir hasta el/);

    await llenarFormulario();
    await userEvent.type(screen.getByLabelText(/DPI/), '1111111111111');
    await userEvent.click(screen.getByRole('button', { name: 'Programar cita' }));

    await waitFor(() =>
      expect(citaService.recibirPaciente).toHaveBeenCalledWith(
        expect.objectContaining({
          paciente: expect.objectContaining({ dpi: '1111111111111' }),
        }),
      ),
    );
  });

  it('manda la respuesta de WhatsApp cuando se pregunta al paciente', async () => {
    renderizar();
    await screen.findByText(/Se puede recibir hasta el/);
    await llenarFormulario();

    await userEvent.selectOptions(screen.getByLabelText(/tiene WhatsApp/), 'false');
    await userEvent.click(screen.getByRole('button', { name: 'Programar cita' }));

    await waitFor(() =>
      expect(citaService.recibirPaciente).toHaveBeenCalledWith(
        expect.objectContaining({ tieneWhatsapp: false }),
      ),
    );
  });

  it('avisa de que habrá que llamarle si dice que no tiene', async () => {
    renderizar();
    await screen.findByText(/Se puede recibir hasta el/);

    await userEvent.selectOptions(screen.getByLabelText(/tiene WhatsApp/), 'false');

    expect(await screen.findByText(/Habrá que llamarle/)).toBeInTheDocument();
  });

  it('no manda nada si no se preguntó, para no borrar lo que ya se sabía', async () => {
    renderizar();
    await screen.findByText(/Se puede recibir hasta el/);
    await llenarFormulario();

    await userEvent.click(screen.getByRole('button', { name: 'Programar cita' }));

    await waitFor(() => expect(citaService.recibirPaciente).toHaveBeenCalled());
    expect(citaService.recibirPaciente.mock.calls[0][0]).not.toHaveProperty('tieneWhatsapp');
  });

  it('parte de lo que ya se sabía del paciente encontrado', async () => {
    pacienteService.buscarPorTelefono.mockResolvedValue([{ ...PACIENTE, tiene_whatsapp: 0 }]);

    renderizar();

    await userEvent.type(screen.getByLabelText(/Teléfono/), '55512345');
    await screen.findByText('Ana López');

    expect(screen.getByLabelText(/tiene WhatsApp/)).toHaveValue('false');
  });

  it('muestra el motivo cuando el backend rechaza la fecha', async () => {
    const rechazo = new Error('El 11/11/2026 ya alcanzó el límite de 40 pacientes.');
    rechazo.detalles = { motivo: 'LIMITE_DIARIO_ALCANZADO', fechas_sugeridas: [] };
    citaService.recibirPaciente.mockRejectedValue(rechazo);

    renderizar();
    await screen.findByText(/Se puede recibir hasta el/);
    await llenarFormulario();

    await userEvent.click(screen.getByRole('button', { name: 'Programar cita' }));

    expect(await screen.findByText('No se pudo programar la cita')).toBeInTheDocument();
    expect(screen.getByText(/alcanzó el límite de 40 pacientes/)).toBeInTheDocument();
  });
});
