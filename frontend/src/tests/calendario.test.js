import { feriadoEn, motivoDiaCerrado } from '@/lib/calendario';

const CONFIGURACION = {
  dias_laborables: [1, 2, 3, 4, 5, 6],
  dias_feriados: [
    { fecha: '2026-09-15', descripcion: 'Independencia', anual: false },
    { fecha: '2020-12-25', descripcion: 'Navidad', anual: true },
  ],
};

describe('feriadoEn', () => {
  it('el suelto solo coincide en su fecha exacta', () => {
    expect(feriadoEn('2026-09-15', CONFIGURACION.dias_feriados)?.descripcion).toBe('Independencia');
    expect(feriadoEn('2027-09-15', CONFIGURACION.dias_feriados)).toBeNull();
  });

  it('el anual coincide cada año', () => {
    expect(feriadoEn('2031-12-25', CONFIGURACION.dias_feriados)?.descripcion).toBe('Navidad');
  });
});

describe('motivoDiaCerrado', () => {
  it.each([
    ['2026-09-15', 'Feriado: Independencia'],
    ['2026-10-11', 'No se atiende los domingos'],
    ['2026-10-12', null],
  ])('%s → %s', (iso, esperado) => {
    expect(motivoDiaCerrado(iso, CONFIGURACION)).toBe(esperado);
  });

  it('sin configuración cargada no apaga nada', () => {
    expect(motivoDiaCerrado('2026-10-11', null)).toBeNull();
  });
});
