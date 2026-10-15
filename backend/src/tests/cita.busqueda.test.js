/**
 * Buscador de citas en todas las fechas: encontrar la cita de un paciente sin
 * saber qué día es.
 */
jest.mock('../config/database');

const database = require('../config/database');
const citaModel = require('../models/cita.model');

describe('condicionDeBusqueda', () => {
  it.each([
    ['5551-2345', '%55512345%'],
    ['55512345', '%55512345%'],
    ['2345', '%2345%'],
  ])('«%s» compara los dígitos %s con el teléfono y el DPI', (termino, esperado) => {
    const { condicion, parametros } = citaModel.condicionDeBusqueda(termino);
    expect(condicion).toContain('p.telefono LIKE :digitos0');
    expect(condicion).toContain('p.dpi LIKE :digitos0');
    expect(parametros.digitos0).toBe(esperado);
  });

  it('cada palabra se busca por separado y todas tienen que aparecer', () => {
    const { condicion, parametros } = citaModel.condicionDeBusqueda('ana  glucosa');
    expect(parametros).toMatchObject({ texto0: '%ana%', texto1: '%glucosa%' });
    expect(condicion).toContain(') AND (');
  });

  it('con letras no compara el teléfono', () => {
    expect(citaModel.condicionDeBusqueda('ana').parametros.digitos0).toBeNull();
  });

  it('el % y el _ escritos no hacen de comodín', () => {
    expect(citaModel.condicionDeBusqueda('50%').parametros.texto0).toBe('%50\\%%');
  });

  it('sin término no hay condición', () => {
    expect(citaModel.condicionDeBusqueda('   ').condicion).toBe('');
  });
});

describe('buscar', () => {
  beforeEach(() => {
    database.query.mockReset();
  });

  it('no filtra por fecha y ordena de la más reciente a la más antigua', async () => {
    database.query.mockResolvedValueOnce([]);

    await citaModel.buscar({ termino: '5551-2345' });

    const [sql, parametros] = database.query.mock.calls[0];
    expect(sql).not.toContain('c.fecha BETWEEN');
    expect(sql).toContain('ORDER BY c.fecha DESC');
    expect(parametros.digitos0).toBe('%55512345%');
  });

  it('sin término no consulta la base', async () => {
    await expect(citaModel.buscar({ termino: '' })).resolves.toEqual([]);
    expect(database.query).not.toHaveBeenCalled();
  });
});
