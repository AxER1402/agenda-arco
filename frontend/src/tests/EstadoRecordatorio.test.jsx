import { render, screen } from '@testing-library/react';

import EstadoRecordatorio from '@/components/citas/EstadoRecordatorio';

function cita(cambios = {}) {
  return {
    id: 1,
    estado: 'PENDIENTE',
    recordatorio_estado: null,
    recordatorio_enviado_en: null,
    recordatorio_programado_para: null,
    recordatorio_error: null,
    ...cambios,
  };
}

describe('EstadoRecordatorio', () => {
  it('dice que no se ha notificado cuando no hay recordatorio', () => {
    render(<EstadoRecordatorio cita={cita()} />);

    expect(screen.getByText('Sin notificar')).toBeInTheDocument();
  });

  it('muestra cuándo se envió', () => {
    render(
      <EstadoRecordatorio
        cita={cita({
          recordatorio_estado: 'ENVIADO',
          recordatorio_enviado_en: '2026-08-11 19:25:35',
        })}
      />,
    );

    expect(screen.getByText('Notificado')).toBeInTheDocument();
    expect(screen.getByText('11/08/2026 07:25 PM')).toBeInTheDocument();
  });

  it('avisa de cuándo saldrá el que está programado', () => {
    render(
      <EstadoRecordatorio
        cita={cita({
          recordatorio_estado: 'PENDIENTE',
          recordatorio_programado_para: '2026-08-12 08:00:00',
        })}
      />,
    );

    expect(screen.getByText('Programado')).toBeInTheDocument();
    expect(screen.getByText(/Se enviará el 12\/08\/2026 08:00 AM/)).toBeInTheDocument();
  });

  it('distingue el fallo de la falta de aviso, y explica el motivo', () => {
    render(
      <EstadoRecordatorio
        cita={cita({
          recordatorio_estado: 'FALLIDO',
          recordatorio_error: 'NUMERO_SIN_WHATSAPP',
        })}
      />,
    );

    expect(screen.getByText('Falló')).toBeInTheDocument();
    expect(screen.getByText('NUMERO_SIN_WHATSAPP')).toBeInTheDocument();
    expect(screen.queryByText('Sin notificar')).not.toBeInTheDocument();
  });

  it.each(['ATENDIDA', 'NO_ASISTIO', 'CANCELADA'])(
    'no reclama nada en una cita %s a la que nunca se avisó',
    (estado) => {
      render(<EstadoRecordatorio cita={cita({ estado })} />);

      expect(screen.queryByText('Sin notificar')).not.toBeInTheDocument();
      expect(screen.getByText('—')).toBeInTheDocument();
    },
  );

  it('sí muestra el aviso enviado aunque la cita ya se haya atendido', () => {
    render(
      <EstadoRecordatorio
        cita={cita({
          estado: 'ATENDIDA',
          recordatorio_estado: 'ENVIADO',
          recordatorio_enviado_en: '2026-08-11 08:00:00',
        })}
      />,
    );

    expect(screen.getByText('Notificado')).toBeInTheDocument();
  });
});
