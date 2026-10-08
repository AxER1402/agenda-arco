/**
 * Buscador de pacientes: el teléfono y el DPI se encuentran se escriban como
 * se escriban, igual que en el buscador de citas.
 */
jest.mock('../config/database');

const database = require('../config/database');
const pacienteModel = require('../models/paciente.model');

describe('parametrosDeBusqueda', () => {
  it.each([
    ['5551-2345', '%55512345%'],
    ['55512345', '%55512345%'],
    [' 5551 2345 ', '%55512345%'],
    ['2345', '%2345%'],
    ['1234 56789 0101', '%1234567890101%'],
  ])('«%s» compara los dígitos %s', (termino, esperado) => {
    expect(pacienteModel.parametrosDeBusqueda(termino).filtroDigitos).toBe(esperado);
  });

  it('con letras no compara teléfono ni DPI, solo el nombre', () => {
    expect(pacienteModel.parametrosDeBusqueda('Ana 5551')).toEqual({
      hayTermino: 1,
      filtroNombre: '%Ana 5551%',
      filtroDigitos: null,
    });
  });

  it('un guion suelto no es un número', () => {
    expect(pacienteModel.parametrosDeBusqueda('-').filtroDigitos).toBeNull();
  });

  it('sin término no filtra', () => {
    expect(pacienteModel.parametrosDeBusqueda('   ').hayTermino).toBe(0);
  });
});

describe('buscar', () => {
  beforeEach(() => {
    database.query.mockResolvedValue([]);
    database.queryOne.mockResolvedValue({ total: 0 });
  });

  it('manda a MySQL el teléfono sin guion, en la lista y en el total', async () => {
    await pacienteModel.buscar({ termino: '5551-2345' });

    const [sql, parametros] = database.query.mock.calls[0];
    expect(sql).toContain('telefono LIKE :filtroDigitos');
    expect(parametros.filtroDigitos).toBe('%55512345%');
    expect(database.queryOne.mock.calls[0][1].filtroDigitos).toBe('%55512345%');
  });
});
