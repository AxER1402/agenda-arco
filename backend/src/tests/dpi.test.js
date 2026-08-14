/**
 * Regla del DPI: opcional, pero de 13 dígitos exactos si se registra.
 */
const { normalizarDpi, esDpiValido, esDpiOpcionalValido, formatearDpi } = require('../utils/dpi');

describe('esDpiValido', () => {
  it('acepta 13 dígitos', () => {
    expect(esDpiValido('1111111111111')).toBe(true);
  });

  it.each([
    ['1111111111', 'solo 10 dígitos'],
    ['111111111111', '12 dígitos'],
    ['11111111111111', '14 dígitos'],
    ['', 'vacío'],
    ['111111111111A', 'con una letra'],
  ])('rechaza %s (%s)', (valor) => {
    expect(esDpiValido(valor)).toBe(false);
  });
});

describe('normalizarDpi', () => {
  it('quita espacios y guiones', () => {
    expect(normalizarDpi('1111 11111 1111')).toBe('1111111111111');
    expect(normalizarDpi('1111-11111-1111')).toBe('1111111111111');
  });

  it('devuelve cadena vacía si no hay nada utilizable', () => {
    expect(normalizarDpi(null)).toBe('');
    expect(normalizarDpi(undefined)).toBe('');
  });
});

describe('esDpiOpcionalValido', () => {
  it.each([undefined, null, '', '   '])('acepta que no se registre (%s)', (valor) => {
    expect(esDpiOpcionalValido(valor)).toBe(true);
  });

  it('acepta un DPI completo', () => {
    expect(esDpiOpcionalValido('1111111111111')).toBe(true);
  });

  it('rechaza uno a medias', () => {
    expect(esDpiOpcionalValido('1111111111')).toBe(false);
  });
});

describe('formatearDpi', () => {
  it('agrupa los dígitos para mostrarlos', () => {
    expect(formatearDpi('1111111111111')).toBe('1111 11111 1111');
  });

  it('deja el valor tal cual si no es un DPI', () => {
    expect(formatearDpi('123')).toBe('123');
  });
});
