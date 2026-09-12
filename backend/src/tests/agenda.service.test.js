/**
 * Vistas de la agenda y disponibilidad (requisitos 7, 14 y 17).
 */
jest.mock('../models/cita.model');
jest.mock('../models/orden.model');
jest.mock('../models/configuracion.model');

const citaModel = require('../models/cita.model');
const ordenModel = require('../models/orden.model');
const configuracionModel = require('../models/configuracion.model');

const agendaService = require('../services/agenda.service');
const disponibilidadService = require('../services/disponibilidad.service');
const fechas = require('../utils/fechas');

const LIMITE = 40;

function configurar({ limite = LIMITE, diasLaborables = '1,2,3,4,5,6' } = {}) {
  const valores = {
    limite_diario_pacientes: String(limite),
    vigencia_orden_meses: '3',
    dias_laborables: diasLaborables,
    hora_apertura: '07:00',
    hora_cierre: '09:00',
    intervalo_citas_minutos: '30',
    nombre_laboratorio: 'El Arco Laboratorios',
  };

  configuracionModel.obtener.mockImplementation(async (clave) =>
    valores[clave] ? { clave, valor: valores[clave] } : null,
  );
}

beforeEach(() => {
  configurar();
  citaModel.listarPorRango.mockResolvedValue([]);
  citaModel.contarOcupacionPorRango.mockResolvedValue(new Map());
  citaModel.contarOcupacion.mockResolvedValue(0);
  ordenModel.listarPorVencer.mockResolvedValue([]);
});

describe('calcularRango', () => {
  it('la vista de día cubre un solo día', () => {
    expect(agendaService.calcularRango('dia', '2026-08-13')).toEqual({
      desde: '2026-08-13',
      hasta: '2026-08-13',
    });
  });

  it('la vista de semana va de lunes a domingo', () => {
    expect(agendaService.calcularRango('semana', '2026-08-13')).toEqual({
      desde: '2026-08-10',
      hasta: '2026-08-16',
    });
  });

  it('la vista de mes cubre el mes completo', () => {
    expect(agendaService.calcularRango('mes', '2026-08-13')).toEqual({
      desde: '2026-08-01',
      hasta: '2026-08-31',
    });
  });
});

describe('obtenerVista', () => {
  it('genera la estructura de todos los días sin que nadie la cree a mano', async () => {
    const resultado = await agendaService.obtenerVista('mes', '2026-08-13');

    // Agosto tiene 31 días: la agenda del mes aparece completa.
    expect(resultado.dias).toHaveLength(31);
    expect(resultado.dias[0].fecha).toBe('2026-08-01');
    expect(resultado.dias[30].fecha).toBe('2026-08-31');
  });

  it('marca los domingos como no laborables', async () => {
    const resultado = await agendaService.obtenerVista('semana', '2026-08-13');
    const domingo = resultado.dias.find((dia) => dia.dia_semana === 7);

    expect(domingo.laborable).toBe(false);
    expect(domingo.disponibles).toBe(0);
  });

  it('calcula los espacios disponibles de cada día', async () => {
    citaModel.contarOcupacionPorRango.mockResolvedValue(new Map([['2026-08-13', 10]]));

    const resultado = await agendaService.obtenerVista('dia', '2026-08-13');

    expect(resultado.dias[0]).toMatchObject({ ocupacion: 10, disponibles: LIMITE - 10 });
  });

  it('coloca cada cita en su día y añade los datos que la agenda muestra', async () => {
    citaModel.listarPorRango.mockResolvedValue([
      {
        id: 1,
        fecha: '2026-08-13',
        hora: '09:00:00',
        fecha_vencimiento: '2026-11-10',
        paciente_nombre: 'Ana López',
      },
    ]);

    const resultado = await agendaService.obtenerVista('dia', '2026-08-13');
    const [cita] = resultado.dias[0].citas;

    expect(cita.hora_texto).toBe('09:00 AM');
    expect(cita.vencimiento_texto).toBe('10/11/2026');
    expect(cita.dias_para_vencer).toBe(89);
  });

  it('rechaza una vista desconocida', async () => {
    await expect(agendaService.obtenerVista('trimestre', '2026-08-13')).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});

describe('disponibilidad.sugerirFechas', () => {
  const HOY = fechas.hoy();

  it('propone solo días laborables', async () => {
    configurar({ diasLaborables: '1,2,3,4,5' });

    const sugerencias = await disponibilidadService.sugerirFechas({
      desde: HOY,
      hasta: fechas.sumarDias(HOY, 20),
      cantidad: 5,
    });

    sugerencias.forEach(({ fecha }) => {
      expect(fechas.diaDeLaSemana(fecha)).toBeLessThanOrEqual(5);
    });
  });

  it('omite los días que ya alcanzaron el límite', async () => {
    const lleno = fechas.sumarDias(HOY, 1);
    citaModel.contarOcupacionPorRango.mockResolvedValue(new Map([[lleno, LIMITE]]));

    const sugerencias = await disponibilidadService.sugerirFechas({
      desde: HOY,
      hasta: fechas.sumarDias(HOY, 10),
      cantidad: 5,
    });

    expect(sugerencias.map((s) => s.fecha)).not.toContain(lleno);
  });

  it('devuelve como máximo la cantidad pedida', async () => {
    const sugerencias = await disponibilidadService.sugerirFechas({
      desde: HOY,
      hasta: fechas.sumarDias(HOY, 30),
      cantidad: 3,
    });

    expect(sugerencias).toHaveLength(3);
  });

  it('nunca propone fechas pasadas aunque se pidan', async () => {
    const sugerencias = await disponibilidadService.sugerirFechas({
      desde: fechas.sumarDias(HOY, -10),
      hasta: fechas.sumarDias(HOY, 5),
      cantidad: 5,
    });

    sugerencias.forEach(({ fecha }) => {
      expect(fechas.comparar(fecha, HOY)).toBeGreaterThanOrEqual(0);
    });
  });

  it('devuelve una lista vacía si la ventana ya pasó', async () => {
    const sugerencias = await disponibilidadService.sugerirFechas({
      desde: fechas.sumarDias(HOY, -20),
      hasta: fechas.sumarDias(HOY, -10),
    });

    expect(sugerencias).toEqual([]);
  });
});

describe('disponibilidad.sugerirFechasParaOrden', () => {
  const HOY = fechas.hoy();

  /** Orden recibida hoy: vence dentro de tres meses. */
  function orden(vencimiento = fechas.sumarMeses(HOY, 3)) {
    return { fecha_vencimiento: vencimiento };
  }

  it('propone primero las fechas más cercanas al vencimiento', async () => {
    const vencimiento = fechas.sumarDias(HOY, 10);

    const sugerencias = await disponibilidadService.sugerirFechasParaOrden(orden(vencimiento), {
      cantidad: 3,
    });

    expect(sugerencias[0].fecha).toBe(vencimiento);
    // Van de la más lejana a la más próxima, no al revés.
    expect(fechas.comparar(sugerencias[0].fecha, sugerencias[1].fecha)).toBeGreaterThan(0);
  });

  it('no propone ninguna fecha posterior al vencimiento', async () => {
    const vencimiento = fechas.sumarDias(HOY, 5);

    const sugerencias = await disponibilidadService.sugerirFechasParaOrden(orden(vencimiento), {
      cantidad: 5,
    });

    sugerencias.forEach(({ fecha }) => {
      expect(fechas.comparar(fecha, vencimiento)).toBeLessThanOrEqual(0);
    });
  });

  it('salta el día del vencimiento si ya está lleno', async () => {
    const vencimiento = fechas.sumarDias(HOY, 10);
    citaModel.contarOcupacionPorRango.mockResolvedValue(new Map([[vencimiento, LIMITE]]));

    const sugerencias = await disponibilidadService.sugerirFechasParaOrden(orden(vencimiento));

    expect(sugerencias.map((s) => s.fecha)).not.toContain(vencimiento);

    // El día anterior al vencimiento puede caer en domingo según cuándo se
    // ejecute la prueba, así que se espera el laborable más cercano hacia atrás.
    let esperada = fechas.sumarDias(vencimiento, -1);
    while (fechas.diaDeLaSemana(esperada) === 7) esperada = fechas.sumarDias(esperada, -1);

    expect(sugerencias[0].fecha).toBe(esperada);
  });

  it('devuelve una lista vacía si la orden ya venció', async () => {
    const sugerencias = await disponibilidadService.sugerirFechasParaOrden(
      orden(fechas.sumarDias(HOY, -1)),
    );

    expect(sugerencias).toEqual([]);
  });
});

describe('disponibilidad.horasDisponibles', () => {
  it('genera las horas según el horario y el intervalo configurados', async () => {
    // 07:00 a 09:00 cada 30 minutos.
    const horas = await disponibilidadService.horasDisponibles('2026-08-13');

    expect(horas.map((h) => h.hora)).toEqual(['07:00', '07:30', '08:00', '08:30']);
  });

  it('marca como ocupadas las horas que ya tienen cita', async () => {
    citaModel.listarPorRango.mockResolvedValue([{ id: 1, hora: '07:30:00' }]);

    const horas = await disponibilidadService.horasDisponibles('2026-08-13');

    expect(horas.find((h) => h.hora === '07:30').ocupada).toBe(true);
    expect(horas.find((h) => h.hora === '08:00').ocupada).toBe(false);
  });

  it('no ofrece horas en un día no laborable', async () => {
    // 2026-08-16 es domingo.
    expect(await disponibilidadService.horasDisponibles('2026-08-16')).toEqual([]);
  });
});

describe('resumen del panel', () => {
  const HOY = fechas.hoy();
  const MANANA = fechas.sumarDias(HOY, 1);
  const AYER = fechas.sumarDias(HOY, -1);

  function cita(cambios = {}) {
    return {
      id: 1,
      fecha: MANANA,
      hora: '09:00:00',
      paciente_nombre: 'Ana López',
      paciente_tiene_whatsapp: 1,
      fecha_vencimiento: fechas.sumarDias(HOY, 30),
      recordatorio_estado: null,
      ...cambios,
    };
  }

  /** Responde según el día que se le pida. */
  function citasPorDia({ manana = [], ayer = [], hoy = [] }) {
    citaModel.listarPorRango.mockImplementation(async ({ desde }) => {
      if (desde === MANANA) return manana;
      if (desde === AYER) return ayer;
      return hoy;
    });
  }

  it('devuelve capacidad, ocupación y espacios disponibles', async () => {
    citaModel.contarOcupacion.mockResolvedValue(12);

    const resumen = await agendaService.obtenerResumen();

    expect(resumen).toMatchObject({
      pacientes_programados: 12,
      capacidad_diaria: LIMITE,
      espacios_disponibles: LIMITE - 12,
    });
  });

  it('trae las citas de mañana y las de ayer, y ninguna más', async () => {
    citasPorDia({
      manana: [cita({ id: 10 })],
      ayer: [cita({ id: 20, fecha: AYER })],
    });

    const resumen = await agendaService.obtenerResumen();

    expect(resumen.citas_manana.map((c) => c.id)).toEqual([10]);
    expect(resumen.citas_ayer.map((c) => c.id)).toEqual([20]);
    // El listado de "próximas citas" a siete días ya no existe.
    expect(resumen.citas_proximas).toBeUndefined();
  });

  it('las de ayer incluyen las canceladas; las de mañana no', async () => {
    await agendaService.obtenerResumen();

    const porFecha = Object.fromEntries(
      citaModel.listarPorRango.mock.calls.map(([args]) => [args.desde, args.incluirCanceladas]),
    );

    expect(porFecha[AYER]).toBe(true);
    expect(porFecha[MANANA]).toBe(false);
  });

  describe('a quién hay que llamar', () => {
    it('marca al paciente cuyo número no tiene WhatsApp', async () => {
      citasPorDia({ manana: [cita({ paciente_tiene_whatsapp: 0 })] });

      const resumen = await agendaService.obtenerResumen();

      expect(resumen.citas_manana[0].necesita_llamada).toBe(true);
      expect(resumen.llamadas_pendientes).toBe(1);
    });

    it('marca a aquel cuyo recordatorio falló', async () => {
      citasPorDia({ manana: [cita({ recordatorio_estado: 'FALLIDO' })] });

      const resumen = await agendaService.obtenerResumen();

      expect(resumen.citas_manana[0].necesita_llamada).toBe(true);
    });

    it('no marca a quien todavía tiene el aviso en cola', async () => {
      citasPorDia({ manana: [cita({ recordatorio_estado: 'PENDIENTE' })] });

      const resumen = await agendaService.obtenerResumen();

      expect(resumen.citas_manana[0].necesita_llamada).toBe(false);
      expect(resumen.llamadas_pendientes).toBe(0);
    });

    it('no marca a quien ya recibió su recordatorio', async () => {
      citasPorDia({ manana: [cita({ recordatorio_estado: 'ENVIADO' })] });

      const resumen = await agendaService.obtenerResumen();

      expect(resumen.citas_manana[0].necesita_llamada).toBe(false);
    });

    it('tampoco a quien todavía no se le ha comprobado el WhatsApp', async () => {
      citasPorDia({ manana: [cita({ paciente_tiene_whatsapp: null })] });

      const resumen = await agendaService.obtenerResumen();

      expect(resumen.citas_manana[0].necesita_llamada).toBe(false);
    });

    it('cuenta cuántas llamadas quedan pendientes', async () => {
      citasPorDia({
        manana: [
          cita({ id: 1, paciente_tiene_whatsapp: 0 }),
          cita({ id: 2, recordatorio_estado: 'FALLIDO' }),
          cita({ id: 3, recordatorio_estado: 'ENVIADO' }),
        ],
      });

      const resumen = await agendaService.obtenerResumen();

      expect(resumen.llamadas_pendientes).toBe(2);
    });
  });
});
