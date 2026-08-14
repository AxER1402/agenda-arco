/**
 * Validación del teléfono de Guatemala (requisito 10 y pruebas obligatorias
 * del requisito 22).
 */
const {
  esTelefonoValido,
  normalizarTelefono,
  formatearTelefono,
} = require('../utils/telefono');

describe('esTelefonoValido', () => {
  it.each(['23232323', '55555555', '12345678', '00000000'])(
    'acepta %s (ocho dígitos)',
    (telefono) => {
      expect(esTelefonoValido(telefono)).toBe(true);
    },
  );

  it.each([
    ['2323232', 'siete dígitos'],
    ['232323233', 'nueve dígitos'],
    ['', 'cadena vacía'],
    ['abcdefgh', 'letras'],
    ['2323-232', 'siete dígitos con guion'],
  ])('rechaza %s (%s)', (telefono) => {
    expect(esTelefonoValido(telefono)).toBe(false);
  });

  it.each([null, undefined, {}, []])('rechaza el valor %p', (valor) => {
    expect(esTelefonoValido(valor)).toBe(false);
  });
});

describe('normalizarTelefono', () => {
  it.each([
    ['2323-2323', '23232323'],
    ['2323 2323', '23232323'],
    ['(502) 5555-5555', '55555555'],
    ['+502 5555 5555', '55555555'],
    ['50255555555', '55555555'],
  ])('convierte %s en %s', (entrada, esperado) => {
    expect(normalizarTelefono(entrada)).toBe(esperado);
  });

  it('no recorta números que solo empiezan por 502 sin ser código de país', () => {
    // 50255555 son ocho dígitos: es un número local válido, no lleva código.
    expect(normalizarTelefono('50255555')).toBe('50255555');
    expect(esTelefonoValido('50255555')).toBe(true);
  });
});

describe('formatearTelefono', () => {
  it('muestra el número como 5555-5555', () => {
    expect(formatearTelefono('55555555')).toBe('5555-5555');
  });

  it('devuelve el valor tal cual si no es válido', () => {
    expect(formatearTelefono('123')).toBe('123');
  });
});
