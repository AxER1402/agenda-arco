import { render, waitFor } from '@testing-library/react';

import BotonGoogle from '@/components/BotonGoogle';

/**
 * Se simula la librería de Google ya cargada: las pruebas no salen a la red y
 * lo que interesa es qué se le pide y qué se hace con lo que devuelve.
 */
function simularGoogle() {
  const id = { initialize: jest.fn(), renderButton: jest.fn() };
  window.google = { accounts: { id } };
  return id;
}

describe('BotonGoogle', () => {
  afterEach(() => {
    delete window.google;
  });

  it('inicializa Google con el cliente y dibuja el botón en español', async () => {
    const id = simularGoogle();

    render(<BotonGoogle clientId="cliente.apps.googleusercontent.com" onCredencial={jest.fn()} />);

    await waitFor(() => expect(id.renderButton).toHaveBeenCalled());
    expect(id.initialize).toHaveBeenCalledWith(
      expect.objectContaining({ client_id: 'cliente.apps.googleusercontent.com' }),
    );
    expect(id.renderButton.mock.calls[0][1]).toMatchObject({
      locale: 'es',
      text: 'continue_with',
    });
  });

  it('entrega la credencial que devuelve Google', async () => {
    const id = simularGoogle();
    const onCredencial = jest.fn();

    render(<BotonGoogle clientId="cliente.apps.googleusercontent.com" onCredencial={onCredencial} />);
    await waitFor(() => expect(id.initialize).toHaveBeenCalled());

    const { callback } = id.initialize.mock.calls[0][0];
    callback({ credential: 'credencial-de-google' });

    expect(onCredencial).toHaveBeenCalledWith('credencial-de-google');
  });

  /** Google guarda la primera función; si el padre cambia la suya, manda la nueva. */
  it('usa siempre la última función recibida', async () => {
    const id = simularGoogle();
    const primera = jest.fn();
    const segunda = jest.fn();

    const { rerender } = render(
      <BotonGoogle clientId="cliente.apps.googleusercontent.com" onCredencial={primera} />,
    );
    await waitFor(() => expect(id.initialize).toHaveBeenCalled());
    rerender(<BotonGoogle clientId="cliente.apps.googleusercontent.com" onCredencial={segunda} />);

    id.initialize.mock.calls[0][0].callback({ credential: 'credencial-de-google' });

    expect(primera).not.toHaveBeenCalled();
    expect(segunda).toHaveBeenCalledWith('credencial-de-google');
    expect(id.initialize).toHaveBeenCalledTimes(1);
  });
});
