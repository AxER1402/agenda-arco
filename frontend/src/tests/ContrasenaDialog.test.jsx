import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ContrasenaDialog from '@/components/usuarios/ContrasenaDialog';

function renderizar(props = {}) {
  const onGuardar = props.onGuardar ?? jest.fn().mockResolvedValue(undefined);

  render(
    <ContrasenaDialog
      abierto
      onCerrar={jest.fn()}
      titulo="Nueva contraseña para Ana López"
      textoGuardar="Restablecer"
      {...props}
      onGuardar={onGuardar}
    />,
  );

  return {
    onGuardar,
    nueva: screen.getByLabelText(/Contraseña nueva/),
    repetida: screen.getByLabelText(/Repita la contraseña/),
    boton: screen.getByRole('button', { name: 'Restablecer' }),
  };
}

describe('ContrasenaDialog', () => {
  it('no deja guardar mientras las dos contraseñas no coincidan', async () => {
    const { nueva, repetida, boton } = renderizar();

    await userEvent.type(nueva, 'ClaveSegura2026');
    await userEvent.type(repetida, 'ClaveSegura2027');

    expect(await screen.findByText('Las dos contraseñas no coinciden.')).toBeInTheDocument();
    expect(boton).toBeDisabled();
  });

  it('no deja guardar una contraseña más corta que el mínimo', async () => {
    const { nueva, repetida, boton } = renderizar();

    await userEvent.type(nueva, 'corta');
    await userEvent.type(repetida, 'corta');

    expect(await screen.findByText('Debe tener al menos 8 caracteres.')).toBeInTheDocument();
    expect(boton).toBeDisabled();
  });

  it('guarda cuando las dos coinciden y llegan al mínimo', async () => {
    const { onGuardar, nueva, repetida, boton } = renderizar();

    await userEvent.type(nueva, 'ClaveSegura2026');
    await userEvent.type(repetida, 'ClaveSegura2026');

    expect(boton).toBeEnabled();
    await userEvent.click(boton);

    await waitFor(() => expect(onGuardar).toHaveBeenCalledWith('ClaveSegura2026'));
  });

  it('deja ver la contraseña escrita', async () => {
    const { nueva } = renderizar();

    await userEvent.type(nueva, 'ClaveSegura2026');
    expect(nueva).toHaveAttribute('type', 'password');

    await userEvent.click(screen.getAllByRole('button', { name: 'Ver la contraseña' })[0]);
    expect(nueva).toHaveAttribute('type', 'text');
  });

  it('muestra el error del servidor y no cierra el diálogo', async () => {
    const onCerrar = jest.fn();
    const { nueva, repetida, boton } = renderizar({
      onCerrar,
      onGuardar: jest.fn().mockRejectedValue(new Error('El usuario no existe.')),
    });

    await userEvent.type(nueva, 'ClaveSegura2026');
    await userEvent.type(repetida, 'ClaveSegura2026');
    await userEvent.click(boton);

    expect(await screen.findByText('El usuario no existe.')).toBeInTheDocument();
    expect(onCerrar).not.toHaveBeenCalled();
  });
});
