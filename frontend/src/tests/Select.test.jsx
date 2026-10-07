import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Select } from '@/components/ui/select';

function Campo({ inicial = '' }) {
  const [valor, setValor] = useState(inicial);
  return (
    <>
      <label htmlFor="campo">Respuesta</label>
      <Select id="campo" value={valor} onChange={(evento) => setValor(evento.target.value)}>
        <option value="">Sin comprobar</option>
        <option value="true">Sí tiene</option>
        <option value="false">No tiene</option>
      </Select>
    </>
  );
}

describe('Select', () => {
  it('muestra el texto de la opción elegida', () => {
    render(<Campo inicial="true" />);
    expect(screen.getByLabelText('Respuesta')).toHaveTextContent('Sí tiene');
  });

  it('abre la lista y elige con el ratón', async () => {
    render(<Campo />);

    await userEvent.click(screen.getByLabelText('Respuesta'));
    expect(screen.getByRole('option', { name: 'Sin comprobar' })).toHaveAttribute('aria-selected', 'true');

    await userEvent.click(screen.getByRole('option', { name: 'No tiene' }));

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Respuesta')).toHaveTextContent('No tiene');
    expect(screen.getByLabelText('Respuesta')).toHaveFocus();
  });

  it('cambia el valor con las flechas sin abrir la lista', async () => {
    render(<Campo />);
    screen.getByLabelText('Respuesta').focus();

    await userEvent.keyboard('{ArrowDown}{ArrowDown}');

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Respuesta')).toHaveTextContent('No tiene');
  });

  it('salta a la opción que empieza por la letra pulsada', async () => {
    render(<Campo />);
    screen.getByLabelText('Respuesta').focus();

    await userEvent.keyboard('n');

    expect(screen.getByLabelText('Respuesta')).toHaveTextContent('No tiene');
  });

  it('con la lista abierta, Enter elige la opción activa', async () => {
    render(<Campo />);
    screen.getByLabelText('Respuesta').focus();

    await userEvent.keyboard('{Enter}{ArrowDown}{Enter}');

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Respuesta')).toHaveTextContent('Sí tiene');
  });

  it('Escape cierra la lista sin cambiar el valor', async () => {
    render(<Campo inicial="false" />);
    screen.getByLabelText('Respuesta').focus();

    await userEvent.keyboard('{Enter}{ArrowUp}{Escape}');

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Respuesta')).toHaveTextContent('No tiene');
  });
});
