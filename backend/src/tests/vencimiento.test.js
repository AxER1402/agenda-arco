/**
 * Cálculo del vencimiento de las órdenes del IGSS y regla de vigencia
 * (requisitos 12 y 13; pruebas obligatorias del requisito 22).
 */
const ordenService = require('../services/orden.service');

const { calcularVencimiento, fechaDentroDeVigencia, diasParaVencer } = ordenService;

describe('calcularVencimiento', () => {
  it('suma tres meses al ejemplo del requisito: 10/08/2026 → 10/11/2026', () => {
    expect(calcularVencimiento('2026-08-10', 3)).toBe('2026-11-10');
  });

  // El caso tal como lo enuncia el laboratorio: recibida el 11 de agosto, el 11
  // de noviembre todavía se atiende y el 12 ya no.
  describe('orden recibida el 11/08/2026', () => {
    const vencimiento = calcularVencimiento('2026-08-11', 3);

    it('vence el 11/11/2026', () => {
      expect(vencimiento).toBe('2026-11-11');
    });

    it('el 11 de noviembre todavía se puede recibir', () => {
      expect(fechaDentroDeVigencia('2026-11-11', vencimiento)).toBe(true);
    });

    it('el 12 de noviembre ya no', () => {
      expect(fechaDentroDeVigencia('2026-11-12', vencimiento)).toBe(false);
    });
  });

  it.each([
    ['2026-01-15', '2026-04-15'],
    ['2026-06-01', '2026-09-01'],
    ['2026-09-30', '2026-12-30'],
  ])('%s vence el %s', (entrega, esperado) => {
    expect(calcularVencimiento(entrega, 3)).toBe(esperado);
  });

  it('cruza el fin de año correctamente', () => {
    expect(calcularVencimiento('2026-11-20', 3)).toBe('2027-02-20');
  });

  it('usa el último día del mes cuando el día no existe en el mes destino', () => {
    // 30 de noviembre + 3 meses caería en un 30 de febrero, que no existe.
    expect(calcularVencimiento('2025-11-30', 3)).toBe('2026-02-28');
  });

  it('respeta el 29 de febrero en año bisiesto', () => {
    expect(calcularVencimiento('2027-11-29', 3)).toBe('2028-02-29');
  });

  it('mantiene el día 31 cuando el mes destino sí lo tiene', () => {
    expect(calcularVencimiento('2026-08-31', 3)).toBe('2026-11-30');
    expect(calcularVencimiento('2026-12-31', 3)).toBe('2027-03-31');
  });

  it('acepta una vigencia distinta de tres meses si el laboratorio la cambia', () => {
    expect(calcularVencimiento('2026-08-10', 6)).toBe('2027-02-10');
    expect(calcularVencimiento('2026-08-10', 1)).toBe('2026-09-10');
  });

  it('rechaza una fecha de entrega inválida', () => {
    expect(() => calcularVencimiento('2026-02-31', 3)).toThrow();
    expect(() => calcularVencimiento('no-es-fecha', 3)).toThrow();
  });
});

describe('fechaDentroDeVigencia — ejemplo del requisito 13', () => {
  const VENCIMIENTO = '2026-11-10';

  it.each(['2026-11-08', '2026-11-09'])('%s es válida (anterior al vencimiento)', (fecha) => {
    expect(fechaDentroDeVigencia(fecha, VENCIMIENTO)).toBe(true);
  });

  it('el mismo día del vencimiento es válido', () => {
    expect(fechaDentroDeVigencia('2026-11-10', VENCIMIENTO)).toBe(true);
  });

  it.each(['2026-11-11', '2026-11-12'])('%s es inválida (posterior al vencimiento)', (fecha) => {
    expect(fechaDentroDeVigencia(fecha, VENCIMIENTO)).toBe(false);
  });

  it('una fecha muy anterior sigue siendo válida en cuanto a vigencia', () => {
    expect(fechaDentroDeVigencia('2026-08-11', VENCIMIENTO)).toBe(true);
  });
});

/**
 * El ejemplo del laboratorio: orden entregada el 1 de octubre, vence el 1 de
 * enero. Si la cita del IGSS es antes —1 de diciembre— manda ella; si es
 * después —1 de febrero— manda el vencimiento.
 */
describe('fechaLimiteCita', () => {
  const { fechaLimiteCita } = ordenService;
  const VENCE = calcularVencimiento('2026-10-01', 3);

  it('sin cita del IGSS, el límite es el vencimiento', () => {
    expect(VENCE).toBe('2027-01-01');
    expect(fechaLimiteCita({ fecha_vencimiento: VENCE })).toEqual({
      fecha: '2027-01-01',
      motivo: 'VENCIMIENTO',
    });
  });

  it('con la cita del IGSS antes del vencimiento, el límite es su víspera', () => {
    expect(fechaLimiteCita({ fecha_vencimiento: VENCE, fecha_cita_igss: '2026-12-01' })).toEqual({
      fecha: '2026-11-30',
      motivo: 'CITA_IGSS',
    });
  });

  it('con la cita del IGSS después del vencimiento, sigue mandando el vencimiento', () => {
    expect(fechaLimiteCita({ fecha_vencimiento: VENCE, fecha_cita_igss: '2027-02-01' })).toEqual({
      fecha: '2027-01-01',
      motivo: 'VENCIMIENTO',
    });
  });

  it('con la cita del IGSS el día siguiente al vencimiento, el vencimiento sigue valiendo', () => {
    expect(
      fechaLimiteCita({ fecha_vencimiento: VENCE, fecha_cita_igss: '2027-01-02' }).motivo,
    ).toBe('VENCIMIENTO');
  });
});

describe('normalizarCitaIgss', () => {
  const { normalizarCitaIgss } = ordenService;

  it('acepta una fecha posterior a la entrega', () => {
    expect(normalizarCitaIgss('2026-12-01', '2026-10-01')).toBe('2026-12-01');
  });

  it('deja en null una fecha vacía y en undefined una que no se mandó', () => {
    expect(normalizarCitaIgss('', '2026-10-01')).toBeNull();
    expect(normalizarCitaIgss(undefined, '2026-10-01')).toBeUndefined();
  });

  it('rechaza una cita del IGSS anterior a la entrega de la orden', () => {
    expect(() => normalizarCitaIgss('2026-09-30', '2026-10-01')).toThrow(/anterior/);
  });
});

describe('diasParaVencer', () => {
  it('cuenta los días que faltan', () => {
    expect(diasParaVencer('2026-11-10', '2026-11-01')).toBe(9);
  });

  it('devuelve 0 el mismo día del vencimiento', () => {
    expect(diasParaVencer('2026-11-10', '2026-11-10')).toBe(0);
  });

  it('devuelve un número negativo si ya venció', () => {
    expect(diasParaVencer('2026-11-10', '2026-11-15')).toBe(-5);
  });
});
