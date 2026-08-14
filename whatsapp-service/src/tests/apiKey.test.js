const { requireApiKey } = require('../middleware/apiKey');

const API_KEY = 'clave-interna-solo-para-pruebas';

function respuestaFalsa() {
  return {
    codigo: null,
    cuerpo: null,
    status(codigo) {
      this.codigo = codigo;
      return this;
    },
    json(cuerpo) {
      this.cuerpo = cuerpo;
      return this;
    },
  };
}

function peticionFalsa(clave) {
  return { get: (nombre) => (nombre.toLowerCase() === 'x-api-key' ? clave : undefined) };
}

describe('requireApiKey', () => {
  it('deja pasar la clave correcta', () => {
    const next = jest.fn();

    requireApiKey(peticionFalsa(API_KEY), respuestaFalsa(), next);

    expect(next).toHaveBeenCalled();
  });

  it.each([
    ['una clave incorrecta de la misma longitud', 'clave-interna-solo-para-pruebaX'],
    ['una clave más corta', 'corta'],
    ['una clave más larga', `${API_KEY}-extra`],
    ['ninguna clave', undefined],
    ['una clave vacía', ''],
  ])('rechaza %s', (_caso, clave) => {
    const next = jest.fn();
    const res = respuestaFalsa();

    requireApiKey(peticionFalsa(clave), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.codigo).toBe(401);
  });
});
