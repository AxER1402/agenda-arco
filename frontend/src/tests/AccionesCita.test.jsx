import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import AccionesCita from '@/components/citas/AccionesCita';
import * as catalogoService from '@/services/catalogo.service';
import * as citaService from '@/services/cita.service';
import * as pacienteService from '@/services/paciente.service';
import * as recordatorioService from '@/services/recordatorio.service';
import { hoyISO } from '@/lib/formato';

jest.mock('@/services/catalogo.service');
jest.mock('@/services/cita.service');
jest.mock('@/services/paciente.service');
jest.mock('@/services/recordatorio.service');
jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn(), info: jest.fn() },
}));

const { toast } = require('sonner');

function cita(cambios = {}) {
  return {
    id: 7,
    paciente_id: 3,
    paciente_nombre: 'Ana López',
    fecha: hoyISO(),
    hora: '09:00:00',
    estado: 'PENDIENTE',
    estado_nombre: 'Pendiente',
    ...cambios,
  };
}

function renderizar(datos, props = {}) {
  return render(
    <AccionesCita cita={datos} onCambiada={jest.fn()} onReprogramar={jest.fn()} {...props} />,
  );
}

/** El menú guarda las acciones secundarias: hay que abrirlo para verlas. */
async function abrirMenu() {
  await userEvent.click(screen.getByRole('button', { name: /Acciones de la cita/ }));
  return screen.findByRole('menu');
}

beforeEach(() => {
  jest.clearAllMocks();
  citaService.eliminarCita.mockResolvedValue({ id: 7, eliminada: true });
  citaService.cambiarEstadoCita.mockResolvedValue({ id: 7 });
  recordatorioService.enviarRecordatorioDeCita.mockResolvedValue({
    enviado: true,
    recordatorio: { id: 3, estado: 'ENVIADO' },
    paciente: 'Ana López',
  });
  pacienteService.obtenerPaciente.mockResolvedValue({
    id: 3,
    nombre_completo: 'Ana López',
    telefono: '55551234',
    dpi: '1234567890123',
  });
  pacienteService.historialDePaciente.mockResolvedValue([]);
  catalogoService.listarOrdenesDePaciente.mockResolvedValue([]);
});

describe('Disposición de las acciones', () => {
  it('deja fuera solo la acción principal y el resto en el menú', async () => {
    renderizar(cita());

    // Una cita pendiente se marca como atendida de un clic, sin abrir nada.
    expect(screen.getByRole('button', { name: /Atendida/ })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Cancelar/ })).not.toBeInTheDocument();

    await abrirMenu();

    expect(screen.getByRole('menuitem', { name: /No asistió/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Cancelar/ })).toBeInTheDocument();
    // Confirmar sigue disponible, pero apartado: al paciente no se le exige.
    expect(screen.getByRole('menuitem', { name: /Confirmar/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Reprogramar/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Eliminar cita/ })).toBeInTheDocument();
  });

  it('el menú se cierra al elegir una opción', async () => {
    renderizar(cita());
    await abrirMenu();

    await userEvent.click(screen.getByRole('menuitem', { name: /Reprogramar/ }));

    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  });

  it('el menú se cierra con Escape', async () => {
    renderizar(cita());
    await abrirMenu();

    await userEvent.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  });
});

/**
 * Cancelar y eliminar son vecinas en el menú y hacen cosas muy distintas: una
 * conserva la cita y la otra la borra. Ninguna se dispara de un solo clic.
 */
describe('Eliminar', () => {
  async function abrirDialogoDeBorrado() {
    await abrirMenu();
    await userEvent.click(screen.getByRole('menuitem', { name: /Eliminar cita/ }));
    return screen.findByRole('dialog');
  }

  it('no borra nada con solo elegir la opción del menú', async () => {
    renderizar(cita());
    await abrirDialogoDeBorrado();

    expect(citaService.eliminarCita).not.toHaveBeenCalled();
  });

  it('exige la contraseña de la sesión antes de dejar confirmar', async () => {
    renderizar(cita());
    await abrirDialogoDeBorrado();

    expect(screen.getByLabelText(/Su contraseña/)).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: /Eliminar definitivamente/ })).toBeDisabled();
  });

  it('elimina la cita con la contraseña escrita', async () => {
    const onCambiada = jest.fn();

    renderizar(cita(), { onCambiada });
    await abrirDialogoDeBorrado();

    await userEvent.type(screen.getByLabelText(/Su contraseña/), 'Laboratorio2026');
    await userEvent.click(screen.getByRole('button', { name: /Eliminar definitivamente/ }));

    await waitFor(() =>
      expect(citaService.eliminarCita).toHaveBeenCalledWith(7, 'Laboratorio2026'),
    );
    expect(onCambiada).toHaveBeenCalled();
  });

  it('no borra nada si se vuelve atrás', async () => {
    renderizar(cita());
    await abrirDialogoDeBorrado();

    await userEvent.click(screen.getByRole('button', { name: 'Volver' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(citaService.eliminarCita).not.toHaveBeenCalled();
  });

  /** Si la contraseña falla, el diálogo debe quedarse para reintentar. */
  it('muestra el error dentro del diálogo y no lo cierra', async () => {
    citaService.eliminarCita.mockRejectedValue(new Error('La contraseña no es correcta.'));

    renderizar(cita());
    await abrirDialogoDeBorrado();

    await userEvent.type(screen.getByLabelText(/Su contraseña/), 'equivocada');
    await userEvent.click(screen.getByRole('button', { name: /Eliminar definitivamente/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('La contraseña no es correcta.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('Cancelar', () => {
  it('no cancela con solo pulsar la opción: primero explica qué hace', async () => {
    renderizar(cita());
    await abrirMenu();

    await userEvent.click(screen.getByRole('menuitem', { name: /Cancelar/ }));

    const dialogo = await screen.findByRole('dialog');
    expect(dialogo).toHaveTextContent(/se conserva en el historial/i);
    expect(citaService.cambiarEstadoCita).not.toHaveBeenCalled();
  });

  it('cancela con el motivo escrito', async () => {
    renderizar(cita());
    await abrirMenu();
    await userEvent.click(screen.getByRole('menuitem', { name: /Cancelar/ }));
    await screen.findByRole('dialog');

    await userEvent.type(screen.getByLabelText(/Motivo/), 'El paciente avisó');
    await userEvent.click(screen.getByRole('button', { name: /Cancelar la cita/ }));

    await waitFor(() =>
      expect(citaService.cambiarEstadoCita).toHaveBeenCalledWith(7, 'CANCELADA', 'El paciente avisó'),
    );
  });

  /** El motivo es opcional: no debe bloquear la cancelación. */
  it('cancela sin motivo', async () => {
    renderizar(cita());
    await abrirMenu();
    await userEvent.click(screen.getByRole('menuitem', { name: /Cancelar/ }));
    await screen.findByRole('dialog');

    await userEvent.click(screen.getByRole('button', { name: /Cancelar la cita/ }));

    await waitFor(() =>
      expect(citaService.cambiarEstadoCita).toHaveBeenCalledWith(7, 'CANCELADA', undefined),
    );
  });

  /** No pide contraseña: se puede reactivar, no se pierde nada. */
  it('no pide la contraseña', async () => {
    renderizar(cita());
    await abrirMenu();
    await userEvent.click(screen.getByRole('menuitem', { name: /Cancelar/ }));
    await screen.findByRole('dialog');

    expect(screen.queryByLabelText(/Su contraseña/)).not.toBeInTheDocument();
  });
});

describe('Recordatorio individual', () => {
  it('lo envía desde el menú', async () => {
    renderizar(cita());
    await abrirMenu();

    await userEvent.click(screen.getByRole('menuitem', { name: /Enviar recordatorio/ }));

    await waitFor(() =>
      expect(recordatorioService.enviarRecordatorioDeCita).toHaveBeenCalledWith(7),
    );
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Ana López'));
  });

  it('avisa con el motivo cuando WhatsApp no pudo entregarlo', async () => {
    recordatorioService.enviarRecordatorioDeCita.mockResolvedValue({
      enviado: false,
      recordatorio: { estado: 'FALLIDO', error_mensaje: 'NUMERO_SIN_WHATSAPP' },
    });

    renderizar(cita());
    await abrirMenu();

    await userEvent.click(screen.getByRole('menuitem', { name: /Enviar recordatorio/ }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('NUMERO_SIN_WHATSAPP'),
        expect.anything(),
      ),
    );
  });

  it.each(['CANCELADA', 'ATENDIDA', 'NO_ASISTIO'])(
    'no se ofrece para una cita %s',
    async (estado) => {
      renderizar(cita({ estado, estado_nombre: estado }));
      await abrirMenu();

      expect(screen.queryByRole('menuitem', { name: /Enviar recordatorio/ })).not.toBeInTheDocument();
    },
  );
});

/**
 * En el mostrador se comprueba quién es la persona sin salir de la agenda: la
 * fila solo lleva nombre y teléfono, así que la ficha se pide entera.
 */
describe('Ficha del paciente', () => {
  it('la abre desde el menú con los datos completos', async () => {
    renderizar(cita());
    await abrirMenu();

    await userEvent.click(screen.getByRole('menuitem', { name: /Ver ficha del paciente/ }));

    await waitFor(() => expect(pacienteService.obtenerPaciente).toHaveBeenCalledWith(3));

    const ficha = await screen.findByRole('dialog');
    expect(ficha).toHaveTextContent('Ana López');
    expect(ficha).toHaveTextContent(/DPI/);
  });

  /** Desde una cita la ficha es de consulta: no hay flujo de alta detrás. */
  it('no ofrece programar cita si no se le pasa el flujo', async () => {
    renderizar(cita());
    await abrirMenu();
    await userEvent.click(screen.getByRole('menuitem', { name: /Ver ficha del paciente/ }));
    await screen.findByRole('dialog');

    expect(screen.queryByRole('button', { name: /Programar cita/ })).not.toBeInTheDocument();
  });

  it('avisa si la ficha no se pudo cargar', async () => {
    pacienteService.obtenerPaciente.mockRejectedValue(new Error('Paciente no encontrado.'));

    renderizar(cita());
    await abrirMenu();
    await userEvent.click(screen.getByRole('menuitem', { name: /Ver ficha del paciente/ }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Paciente no encontrado.'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('Citas confirmadas', () => {
  it('deja quitar una confirmación marcada por error', async () => {
    renderizar(cita({ estado: 'CONFIRMADA', estado_nombre: 'Confirmada' }));

    await abrirMenu();
    await userEvent.click(screen.getByRole('menuitem', { name: /Quitar confirmación/ }));

    await waitFor(() =>
      expect(citaService.cambiarEstadoCita).toHaveBeenCalledWith(7, 'PENDIENTE', undefined),
    );
  });
});

describe('Citas canceladas', () => {
  it('ofrece reactivar fuera y reagendar en el menú', async () => {
    const onReprogramar = jest.fn();

    renderizar(cita({ estado: 'CANCELADA', estado_nombre: 'Cancelada' }), { onReprogramar });

    expect(screen.getByRole('button', { name: /Reactivar/ })).toBeInTheDocument();

    await abrirMenu();
    await userEvent.click(screen.getByRole('menuitem', { name: /Reagendar/ }));

    expect(onReprogramar).toHaveBeenCalled();
  });

  it('con fecha pasada solo deja reagendar', async () => {
    renderizar(cita({ estado: 'CANCELADA', estado_nombre: 'Cancelada', fecha: '2020-01-01' }));

    expect(screen.queryByRole('button', { name: /Reactivar/ })).not.toBeInTheDocument();

    await abrirMenu();

    expect(screen.getByRole('menuitem', { name: /Reagendar/ })).toBeInTheDocument();
  });
});

describe('Citas con desenlace', () => {
  it('una atendida no se reprograma, pero sí se elimina', async () => {
    renderizar(cita({ estado: 'ATENDIDA', estado_nombre: 'Atendida' }));

    await abrirMenu();

    expect(screen.queryByRole('menuitem', { name: /Reprogramar/ })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Eliminar cita/ })).toBeInTheDocument();
  });
});
