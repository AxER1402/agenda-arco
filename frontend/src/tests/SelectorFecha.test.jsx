import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SelectorFecha } from '@/components/ui/selector-fecha';

function Campo({ inicial = '', min, max, diaCerrado }) {
  const [valor, setValor] = useState(inicial);
  return (
    <>
      <label htmlFor="campo">Fecha</label>
      <SelectorFecha
        id="campo"
        value={valor}
        min={min}
        max={max}
        diaCerrado={diaCerrado}
        onChange={(evento) => setValor(evento.target.value)}
      />
    </>
  );
}

describe('SelectorFecha', () => {
  it('muestra la fecha elegida en formato dd/mm/aaaa', () => {
    render(<Campo inicial="2026-11-05" />);

    expect(screen.getByLabelText('Fecha')).toHaveTextContent('05/11/2026');
    expect(screen.getByLabelText('Fecha')).toHaveValue('2026-11-05');
  });

  it('abre el calendario del mes de la fecha y elige un día con el ratón', async () => {
    render(<Campo inicial="2026-11-05" />);

    await userEvent.click(screen.getByLabelText('Fecha'));
    expect(screen.getByRole('grid', { name: 'noviembre 2026' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'viernes 20 de noviembre de 2026' }));

    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Fecha')).toHaveValue('2026-11-20');
  });

  it('cambia de mes con las flechas del encabezado', async () => {
    render(<Campo inicial="2026-11-05" />);

    await userEvent.click(screen.getByLabelText('Fecha'));
    await userEvent.click(screen.getByRole('button', { name: 'Mes siguiente' }));

    expect(screen.getByRole('grid', { name: 'diciembre 2026' })).toBeInTheDocument();
  });

  it('no deja elegir días fuera del rango permitido', async () => {
    render(<Campo inicial="2026-11-05" min="2026-11-03" max="2026-11-10" />);

    await userEvent.click(screen.getByLabelText('Fecha'));

    expect(screen.getByRole('button', { name: 'lunes 2 de noviembre de 2026' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'miércoles 11 de noviembre de 2026' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Mes siguiente' })).toBeDisabled();
  });

  it('se maneja con el teclado', async () => {
    render(<Campo inicial="2026-11-05" />);

    screen.getByLabelText('Fecha').focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByLabelText('Fecha')).toHaveValue('2026-11-06');

    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard('{ArrowDown}{ArrowRight}{Enter}');

    expect(screen.getByLabelText('Fecha')).toHaveValue('2026-11-14');
  });

  it('Escape cierra el calendario sin cambiar la fecha', async () => {
    render(<Campo inicial="2026-11-05" />);

    await userEvent.click(screen.getByLabelText('Fecha'));
    await userEvent.keyboard('{ArrowRight}{Escape}');

    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Fecha')).toHaveValue('2026-11-05');
  });

  describe('días cerrados', () => {
    // Domingos cerrados y el 15 de noviembre de 2026 (domingo) no cuenta aparte.
    const cerrado = (iso) => {
      if (iso === '2026-11-20') return 'Feriado: Prueba';
      return new Date(`${iso}T00:00:00Z`).getUTCDay() === 0 ? 'No se atiende los domingos' : null;
    };

    it('los apaga con su motivo y no deja elegirlos', async () => {
      render(<Campo inicial="2026-11-05" diaCerrado={cerrado} />);
      await userEvent.click(screen.getByLabelText('Fecha'));

      const domingo = screen.getByRole('button', { name: /domingo 8 de noviembre de 2026/ });
      expect(domingo).toHaveAttribute('aria-disabled', 'true');
      expect(domingo).toHaveAttribute('title', 'No se atiende los domingos');

      const feriado = screen.getByRole('button', { name: /viernes 20 de noviembre de 2026/ });
      expect(feriado).toHaveAccessibleName(/Feriado: Prueba/);

      await userEvent.click(feriado);
      expect(screen.getByLabelText('Fecha')).toHaveValue('2026-11-05');
    });

    it('con las flechas se salta los días cerrados', async () => {
      // 07/11/2026 es sábado: el siguiente abierto es el lunes 9.
      render(<Campo inicial="2026-11-07" diaCerrado={cerrado} />);

      screen.getByLabelText('Fecha').focus();
      await userEvent.keyboard('{ArrowDown}');

      expect(screen.getByLabelText('Fecha')).toHaveValue('2026-11-09');
    });
  });
});
