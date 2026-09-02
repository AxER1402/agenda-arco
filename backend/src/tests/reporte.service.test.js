/**
 * Contenido de los reportes.
 *
 * Se comprueba el documento neutro, no el PDF ni el Word: es donde se decide
 * qué columnas lleva cada reporte y cómo salen las cuentas. Que ese documento
 * se pinte bien en los dos formatos lo cubre `reportes.render.test.js`.
 */
jest.mock('../models/cita.model');
jest.mock('../models/configuracion.model');

const citaModel = require('../models/cita.model');
const configuracionModel = require('../models/configuracion.model');

const reporteService = require('../services/reporte.service');

const DESDE = '2026-09-01';
const HASTA = '2026-09-30';

function configurar({ limite = 40, diasLaborables = '1,2,3,4,5,6,7' } = {}) {
  const valores = {
    limite_diario_pacientes: String(limite),
    vigencia_orden_meses: '3',
    dias_laborables: diasLaborables,
    hora_apertura: '07:00',
    hora_cierre: '17:00',
    intervalo_citas_minutos: '15',
    nombre_laboratorio: 'El Arco Laboratorios',
  };

  configuracionModel.obtener.mockImplementation(async (clave) =>
    valores[clave] ? { clave, valor: valores[clave] } : null,
  );
}

function cita(cambios = {}) {
  return {
    id: 1,
    paciente_id: 1,
    fecha: '2026-09-03',
    hora: '07:00:00',
    paciente_nombre: 'Ana López',
    paciente_telefono: '55555555',
    estado: 'ATENDIDA',
    ocupa_cupo: 1,
    recordatorio_estado: 'ENVIADO',
    examenes: [{ id: 1, codigo: 'HEM-001', nombre: 'Hematología completa' }],
    ...cambios,
  };
}

/** Busca una sección por su título; los indicadores no llevan. */
function seccion(documento, titulo) {
  return documento.secciones.find((s) => s.titulo === titulo);
}

function indicador(documento, etiqueta) {
  const bloque = documento.secciones.find((s) => s.tipo === 'indicadores');
  return bloque.datos.find((dato) => dato.etiqueta === etiqueta);
}

beforeEach(() => {
  configurar();
  citaModel.listarPorRango.mockResolvedValue([]);
});

describe('validación del rango', () => {
  it('rechaza una fecha que no es una fecha', async () => {
    await expect(
      reporteService.listadoDeCitas({ desde: 'ayer', hasta: HASTA }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rechaza el rango al revés', async () => {
    await expect(
      reporteService.listadoDeCitas({ desde: HASTA, hasta: DESDE }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rechaza un rango de más de un año', async () => {
    await expect(
      reporteService.resumenDeActividad({ desde: '2026-01-01', hasta: '2027-06-01' }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('acepta un solo día y lo dice sin repetir la fecha', async () => {
    const documento = await reporteService.listadoDeCitas({ desde: DESDE, hasta: DESDE });

    expect(documento.periodo).toBe('01/09/2026');
  });
});

describe('listado de citas', () => {
  it('lleva una fila por cita, con sus exámenes en una celda', async () => {
    citaModel.listarPorRango.mockResolvedValue([
      cita({
        examenes: [
          { id: 1, nombre: 'Hematología completa' },
          { id: 2, nombre: 'Glucosa en ayunas' },
        ],
      }),
    ]);

    const documento = await reporteService.listadoDeCitas({ desde: DESDE, hasta: HASTA });
    const tabla = documento.secciones.find((s) => s.tipo === 'tabla');

    expect(tabla.filas).toHaveLength(1);
    expect(tabla.filas[0]).toMatchObject({
      fecha: '03/09/2026',
      hora: '07:00 AM',
      paciente: 'Ana López',
      examenes: 'Hematología completa, Glucosa en ayunas',
      estado: 'Atendida',
    });
  });

  it('cuenta pacientes distintos, no citas', async () => {
    citaModel.listarPorRango.mockResolvedValue([
      cita({ id: 1, paciente_id: 7 }),
      cita({ id: 2, paciente_id: 7, fecha: '2026-09-10' }),
      cita({ id: 3, paciente_id: 8 }),
    ]);

    const documento = await reporteService.listadoDeCitas({ desde: DESDE, hasta: HASTA });

    expect(indicador(documento, 'Citas').valor).toBe('3');
    expect(indicador(documento, 'Pacientes').valor).toBe('2');
    expect(indicador(documento, 'Días con citas').valor).toBe('2');
  });

  it('incluye las canceladas: es la hoja de lo que se agendó', async () => {
    await reporteService.listadoDeCitas({ desde: DESDE, hasta: HASTA });

    expect(citaModel.listarPorRango).toHaveBeenCalledWith(
      expect.objectContaining({ incluirCanceladas: true }),
    );
  });

  it('deja constancia en el propio reporte de que va filtrado', async () => {
    const documento = await reporteService.listadoDeCitas({
      desde: DESDE,
      hasta: HASTA,
      estado: 'ATENDIDA',
    });

    expect(citaModel.listarPorRango).toHaveBeenCalledWith(
      expect.objectContaining({ estado: 'ATENDIDA' }),
    );
    expect(documento.secciones.at(-1)).toMatchObject({
      tipo: 'nota',
      texto: 'Filtrado por estado: Atendida.',
    });
  });

  it('sale apaisado, que es donde caben los exámenes', async () => {
    const documento = await reporteService.listadoDeCitas({ desde: DESDE, hasta: HASTA });

    expect(documento.orientacion).toBe('horizontal');
  });
});

describe('resumen de actividad', () => {
  it('mide la asistencia solo sobre las citas ya cerradas', async () => {
    citaModel.listarPorRango.mockResolvedValue([
      cita({ id: 1, estado: 'ATENDIDA' }),
      cita({ id: 2, estado: 'ATENDIDA' }),
      cita({ id: 3, estado: 'ATENDIDA' }),
      cita({ id: 4, estado: 'NO_ASISTIO' }),
      // Estas dos no han pasado por el mostrador: no cuentan ni a favor ni en contra.
      cita({ id: 5, estado: 'PENDIENTE' }),
      cita({ id: 6, estado: 'CONFIRMADA' }),
    ]);

    const documento = await reporteService.resumenDeActividad({ desde: DESDE, hasta: HASTA });

    expect(indicador(documento, 'Citas').valor).toBe('6');
    expect(indicador(documento, 'Atendidas').valor).toBe('3');
    expect(indicador(documento, 'Asistencia').valor).toBe('75 %');
    expect(indicador(documento, 'Asistencia').detalle).toBe('Sobre 4 cerradas');
  });

  it('no divide entre cero cuando no hay ninguna cita cerrada', async () => {
    citaModel.listarPorRango.mockResolvedValue([cita({ estado: 'PENDIENTE' })]);

    const documento = await reporteService.resumenDeActividad({ desde: DESDE, hasta: HASTA });

    expect(indicador(documento, 'Asistencia').valor).toBe('0 %');
    expect(indicador(documento, 'Asistencia').detalle).toBe('Sin citas cerradas');
  });

  /**
   * Si la capacidad se calculara sobre los días naturales, un mes con el
   * domingo cerrado daría una ocupación más baja de la real.
   */
  it('mide la ocupación contra los días de atención, no contra los naturales', async () => {
    configurar({ limite: 10, diasLaborables: '1,2,3,4,5' });
    citaModel.listarPorRango.mockResolvedValue([cita()]);

    const documento = await reporteService.resumenDeActividad({
      desde: '2026-09-01',
      hasta: '2026-09-07', // lunes a lunes: cinco días de atención, no siete
    });

    expect(indicador(documento, 'Ocupación').detalle).toBe('1 de 50 espacios');
  });

  it('no cuenta en la ocupación lo que no ocupa cupo', async () => {
    configurar({ limite: 10, diasLaborables: '1' });
    citaModel.listarPorRango.mockResolvedValue([
      cita({ id: 1, ocupa_cupo: 1 }),
      cita({ id: 2, ocupa_cupo: 0, estado: 'CANCELADA' }),
    ]);

    const documento = await reporteService.resumenDeActividad({
      desde: '2026-09-07',
      hasta: '2026-09-07',
    });

    expect(indicador(documento, 'Ocupación').detalle).toBe('1 de 10 espacios');
  });

  it('ordena los exámenes de más pedido a menos', async () => {
    citaModel.listarPorRango.mockResolvedValue([
      cita({ id: 1, examenes: [{ nombre: 'Glucosa' }, { nombre: 'Hematología' }] }),
      cita({ id: 2, examenes: [{ nombre: 'Hematología' }] }),
      cita({ id: 3, examenes: [{ nombre: 'Hematología' }] }),
    ]);

    const documento = await reporteService.resumenDeActividad({ desde: DESDE, hasta: HASTA });

    expect(seccion(documento, 'Exámenes más pedidos').filas).toEqual([
      { examen: 'Hematología', veces: '3' },
      { examen: 'Glucosa', veces: '1' },
    ]);
  });

  it('cuenta como «sin recordatorio» la cita que no llegó a tener uno', async () => {
    citaModel.listarPorRango.mockResolvedValue([
      cita({ id: 1, recordatorio_estado: 'ENVIADO' }),
      cita({ id: 2, recordatorio_estado: null }),
    ]);

    const documento = await reporteService.resumenDeActividad({ desde: DESDE, hasta: HASTA });

    expect(seccion(documento, 'Recordatorios de WhatsApp').filas).toEqual(
      expect.arrayContaining([{ estado: 'Sin recordatorio', citas: '1', parte: '50 %' }]),
    );
  });

  it('se sostiene sin ninguna cita en el periodo', async () => {
    const documento = await reporteService.resumenDeActividad({ desde: DESDE, hasta: HASTA });

    expect(indicador(documento, 'Citas').valor).toBe('0');
    expect(seccion(documento, 'Cómo terminaron las citas').filas).toEqual([]);
  });
});

describe('cabecera', () => {
  it('lleva el nombre del laboratorio y quién lo generó', async () => {
    const documento = await reporteService.listadoDeCitas({
      desde: DESDE,
      hasta: HASTA,
      usuario: { nombre_completo: 'Ana Administradora' },
    });

    expect(documento.laboratorio).toBe('El Arco Laboratorios');
    expect(documento.titulo).toBe('Listado de citas');
    expect(documento.periodo).toBe('Del 01/09/2026 al 30/09/2026');
    expect(documento.generado.usuario).toBe('Ana Administradora');
  });

  it('nombra el archivo con el periodo, para no pisar la descarga anterior', async () => {
    const documento = await reporteService.resumenDeActividad({ desde: DESDE, hasta: HASTA });

    expect(documento.archivo).toBe('actividad-2026-09-01-a-2026-09-30');
  });
});
