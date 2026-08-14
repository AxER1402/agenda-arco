const fechas = require('../utils/fechas');

describe('utils/fechas', () => {
  describe('esFechaReal', () => {
    it.each(['2026-08-10', '2028-02-29', '2026-12-31'])('acepta %s', (fecha) => {
      expect(fechas.esFechaReal(fecha)).toBe(true);
    });

    it.each(['2026-02-30', '2026-13-01', '2026-00-10', '10/08/2026', '2026-8-1'])(
      'rechaza %s',
      (fecha) => {
        expect(fechas.esFechaReal(fecha)).toBe(false);
      },
    );
  });

  describe('comparar', () => {
    it('ordena por día calendario', () => {
      expect(fechas.comparar('2026-08-10', '2026-08-11')).toBeLessThan(0);
      expect(fechas.comparar('2026-08-11', '2026-08-10')).toBeGreaterThan(0);
      expect(fechas.comparar('2026-08-10', '2026-08-10')).toBe(0);
    });

    it('ignora la hora que pueda traer la cadena', () => {
      expect(fechas.comparar('2026-08-10T23:59:00', '2026-08-10')).toBe(0);
    });
  });

  describe('sumarDias', () => {
    it('cruza el cambio de mes', () => {
      expect(fechas.sumarDias('2026-08-31', 1)).toBe('2026-09-01');
    });

    it('resta días', () => {
      expect(fechas.sumarDias('2026-09-01', -1)).toBe('2026-08-31');
    });
  });

  describe('diaDeLaSemana', () => {
    it('devuelve 1 para lunes y 7 para domingo', () => {
      // 2026-08-10 es lunes.
      expect(fechas.diaDeLaSemana('2026-08-10')).toBe(1);
      expect(fechas.diaDeLaSemana('2026-08-16')).toBe(7);
    });
  });

  describe('inicioDeSemana', () => {
    it('devuelve el lunes de esa semana', () => {
      expect(fechas.inicioDeSemana('2026-08-13')).toBe('2026-08-10');
      expect(fechas.inicioDeSemana('2026-08-10')).toBe('2026-08-10');
    });
  });

  describe('rangoDelMes', () => {
    it('cubre el mes completo', () => {
      expect(fechas.rangoDelMes('2026-08-13')).toEqual({
        desde: '2026-08-01',
        hasta: '2026-08-31',
      });
    });

    it('resuelve febrero bisiesto', () => {
      expect(fechas.rangoDelMes('2028-02-10').hasta).toBe('2028-02-29');
    });
  });

  describe('formatos para el usuario', () => {
    it('muestra la fecha como 10/08/2026', () => {
      expect(fechas.aFormatoLocal('2026-08-10')).toBe('10/08/2026');
    });

    it.each([
      ['09:00:00', '09:00 AM'],
      ['13:30:00', '01:30 PM'],
      ['00:15:00', '12:15 AM'],
      ['12:00:00', '12:00 PM'],
    ])('muestra la hora %s como %s', (entrada, esperado) => {
      expect(fechas.horaAFormatoLocal(entrada)).toBe(esperado);
    });
  });

  describe('hoy', () => {
    it('devuelve una fecha en formato AAAA-MM-DD', () => {
      expect(fechas.hoy()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(fechas.esFechaReal(fechas.hoy())).toBe(true);
    });
  });
});
