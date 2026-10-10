/**
 * Reglas críticas de la agenda (requisitos 13, 14 y 16).
 *
 * Se simulan únicamente los modelos: así se ejercita de verdad la lógica de
 * cita.service, orden.service y disponibilidad.service trabajando juntas.
 */
jest.mock('../models/cita.model');
jest.mock('../models/orden.model');
jest.mock('../models/paciente.model');
jest.mock('../models/configuracion.model');
jest.mock('../models/examen.model');
jest.mock('../models/recordatorio.model');
// El borrado definitivo pide la contraseña de la sesión: se simula al usuario y
// la comparación de hashes, no la comprobación en sí, que se ejercita de verdad.
jest.mock('../models/usuario.model');
jest.mock('../utils/password');

const citaModel = require('../models/cita.model');
const ordenModel = require('../models/orden.model');
const pacienteModel = require('../models/paciente.model');
const configuracionModel = require('../models/configuracion.model');
const recordatorioModel = require('../models/recordatorio.model');
const usuarioModel = require('../models/usuario.model');
const password = require('../utils/password');

const citaService = require('../services/cita.service');
const fechas = require('../utils/fechas');

const HOY = fechas.hoy();
const MANANA = fechas.sumarDias(HOY, 1);
const VENCIMIENTO = fechas.sumarDias(HOY, 30);
const AYER = fechas.sumarDias(HOY, -1);

const LIMITE_DIARIO = 40;

function configurarParametros({ limite = LIMITE_DIARIO } = {}) {
  const valores = {
    limite_diario_pacientes: String(limite),
    vigencia_orden_meses: '3',
    // Todos los días laborables: así las pruebas no dependen del día en que se ejecuten.
    dias_laborables: '1,2,3,4,5,6,7',
    hora_apertura: '07:00',
    hora_cierre: '17:00',
    intervalo_citas_minutos: '15',
    nombre_laboratorio: 'El Arco Laboratorios',
  };

  configuracionModel.obtener.mockImplementation(async (clave) =>
    valores[clave] ? { clave, valor: valores[clave] } : null,
  );
}

function ordenDePrueba(cambios = {}) {
  return {
    id: 10,
    paciente_id: 1,
    fecha_entrega: HOY,
    fecha_vencimiento: VENCIMIENTO,
    examenes: [
      { id: 1, codigo: 'HEM-001', nombre: 'Hematología completa' },
      { id: 2, codigo: 'QUI-001', nombre: 'Glucosa' },
    ],
    ...cambios,
  };
}

/** Datos de una cita creada correctamente. */
function citaCreada(cambios = {}) {
  return {
    id: 100,
    paciente_id: 1,
    orden_id: 10,
    fecha: MANANA,
    hora: '09:00:00',
    estado: 'PENDIENTE',
    estado_nombre: 'Pendiente',
    es_final: 0,
    ocupa_cupo: 1,
    ...cambios,
  };
}

beforeEach(() => {
  configurarParametros();

  // Sesión válida por defecto; cada prueba de borrado ajusta lo que necesite.
  usuarioModel.buscarPorId.mockResolvedValue({ id: 7, usuario: 'ana', activo: 1 });
  usuarioModel.buscarPorUsuarioConPassword.mockResolvedValue({
    id: 7,
    usuario: 'ana',
    password_hash: 'hash-de-prueba',
  });
  password.verificar.mockResolvedValue(true);

  pacienteModel.buscarPorId.mockResolvedValue({ id: 1, nombre_completo: 'Ana López', activo: 1 });
  ordenModel.buscarPorId.mockResolvedValue(ordenDePrueba());

  citaModel.contarOcupacion.mockResolvedValue(0);
  citaModel.contarOcupacionPorRango.mockResolvedValue(new Map());
  citaModel.existeCitaActiva.mockResolvedValue(false);
  citaModel.buscarEstadoPorCodigo.mockImplementation(async (codigo) => ({
    id: { PENDIENTE: 1, CONFIRMADA: 2, ATENDIDA: 3, CANCELADA: 4, NO_ASISTIO: 5 }[codigo],
    codigo,
    nombre: codigo,
  }));

  // El modelo invoca la comprobación de cupo dentro de la transacción.
  citaModel.crear.mockImplementation(async (datos, verificarCupo) => {
    verificarCupo(await citaModel.contarOcupacion(datos.fecha));
    return citaCreada({ fecha: datos.fecha, hora: datos.hora });
  });

  citaModel.actualizar.mockImplementation(async (id, cambios, verificarCupo) => {
    if (verificarCupo) verificarCupo(await citaModel.contarOcupacion(cambios.fecha));
    return citaCreada({ id, ...cambios });
  });

  // Por defecto, la cita no tiene recordatorio: la reprogramación no toca nada.
  recordatorioModel.buscarPorCita.mockResolvedValue(null);
  recordatorioModel.crearSiNoExiste.mockImplementation(async (datos) => ({ id: 7, ...datos }));
  recordatorioModel.reabrir.mockImplementation(async (id) => ({ id, estado: 'PENDIENTE' }));
});

// ---------------------------------------------------------------------------

describe('Regla de vigencia al crear una cita', () => {
  const datosBase = { pacienteId: 1, ordenId: 10, hora: '09:00' };

  it('acepta una fecha anterior al vencimiento', async () => {
    const { cita } = await citaService.crear({ ...datosBase, fecha: MANANA });

    expect(cita.fecha).toBe(MANANA);
    expect(citaModel.crear).toHaveBeenCalled();
  });

  it('acepta el mismo día del vencimiento', async () => {
    const { cita } = await citaService.crear({ ...datosBase, fecha: VENCIMIENTO });

    expect(cita.fecha).toBe(VENCIMIENTO);
  });

  it('rechaza una fecha posterior al vencimiento', async () => {
    const posterior = fechas.sumarDias(VENCIMIENTO, 1);

    await expect(citaService.crear({ ...datosBase, fecha: posterior })).rejects.toMatchObject({
      statusCode: 422,
      details: { motivo: 'FUERA_DE_VIGENCIA' },
    });

    expect(citaModel.crear).not.toHaveBeenCalled();
  });

  it('sugiere fechas válidas y todas están dentro de la vigencia', async () => {
    const posterior = fechas.sumarDias(VENCIMIENTO, 5);

    const error = await citaService.crear({ ...datosBase, fecha: posterior }).catch((e) => e);
    const sugeridas = error.details.fechas_sugeridas;

    expect(sugeridas.length).toBeGreaterThan(0);
    sugeridas.forEach(({ fecha, disponibles }) => {
      expect(fechas.comparar(fecha, VENCIMIENTO)).toBeLessThanOrEqual(0);
      expect(fechas.comparar(fecha, HOY)).toBeGreaterThanOrEqual(0);
      expect(disponibles).toBeGreaterThan(0);
    });
  });

  it('avisa de que hace falta una orden nueva si no queda ninguna fecha con cupo', async () => {
    // La orden vence hoy y hoy ya está lleno: no hay ninguna fecha posible.
    ordenModel.buscarPorId.mockResolvedValue(ordenDePrueba({ fecha_vencimiento: HOY }));
    citaModel.contarOcupacionPorRango.mockResolvedValue(new Map([[HOY, LIMITE_DIARIO]]));

    const error = await citaService
      .crear({ ...datosBase, fecha: fechas.sumarDias(HOY, 3) })
      .catch((e) => e);

    expect(error.details.fechas_sugeridas).toHaveLength(0);
    expect(error.details.nota).toContain('orden nueva');
  });

  it('rechaza una fecha en el pasado', async () => {
    await expect(citaService.crear({ ...datosBase, fecha: AYER })).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});

describe('Límite diario de pacientes', () => {
  const datosBase = { pacienteId: 1, ordenId: 10, hora: '09:00', fecha: MANANA };

  it('permite agendar cuando hay disponibilidad', async () => {
    citaModel.contarOcupacion.mockResolvedValue(10);

    const { cita } = await citaService.crear(datosBase);

    expect(cita).toBeDefined();
  });

  it('permite agendar en el último espacio disponible', async () => {
    citaModel.contarOcupacion.mockResolvedValue(LIMITE_DIARIO - 1);

    const { cita } = await citaService.crear(datosBase);

    expect(cita).toBeDefined();
  });

  it('rechaza cuando el día ya alcanzó el límite', async () => {
    citaModel.contarOcupacion.mockResolvedValue(LIMITE_DIARIO);

    await expect(citaService.crear(datosBase)).rejects.toMatchObject({
      statusCode: 409,
      details: { motivo: 'LIMITE_DIARIO_ALCANZADO', limite: LIMITE_DIARIO },
    });

    expect(citaModel.crear).not.toHaveBeenCalled();
  });

  it('sugiere otras fechas cuando el día está lleno', async () => {
    citaModel.contarOcupacion.mockResolvedValue(LIMITE_DIARIO);
    citaModel.contarOcupacionPorRango.mockResolvedValue(new Map([[MANANA, LIMITE_DIARIO]]));

    const error = await citaService.crear(datosBase).catch((e) => e);

    expect(error.details.fechas_sugeridas.length).toBeGreaterThan(0);
    // La fecha llena no puede aparecer entre las sugerencias.
    expect(error.details.fechas_sugeridas.map((s) => s.fecha)).not.toContain(MANANA);
  });

  it('respeta un límite distinto si el laboratorio lo cambia', async () => {
    configurarParametros({ limite: 5 });
    citaModel.contarOcupacion.mockResolvedValue(5);

    await expect(citaService.crear(datosBase)).rejects.toMatchObject({
      details: { limite: 5 },
    });
  });

  it('vuelve a comprobar el cupo dentro de la transacción', async () => {
    // Pasa la validación previa, pero otro usuario ocupa el último lugar justo
    // antes del INSERT.
    citaModel.contarOcupacion
      .mockResolvedValueOnce(LIMITE_DIARIO - 1)
      .mockResolvedValue(LIMITE_DIARIO);

    await expect(citaService.crear(datosBase)).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe('Validaciones adicionales al crear', () => {
  const datosBase = { pacienteId: 1, ordenId: 10, hora: '09:00', fecha: MANANA };

  it('rechaza si la orden pertenece a otro paciente', async () => {
    ordenModel.buscarPorId.mockResolvedValue(ordenDePrueba({ paciente_id: 99 }));

    await expect(citaService.crear(datosBase)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rechaza si el paciente está inactivo', async () => {
    pacienteModel.buscarPorId.mockResolvedValue({ id: 1, activo: 0 });

    await expect(citaService.crear(datosBase)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rechaza una segunda cita activa del mismo paciente el mismo día', async () => {
    citaModel.existeCitaActiva.mockResolvedValue(true);

    await expect(citaService.crear(datosBase)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('rechaza un examen que no pertenece a la orden', async () => {
    await expect(
      citaService.crear({ ...datosBase, examenes: [1, 999] }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('usa todos los exámenes de la orden si no se especifican', async () => {
    await citaService.crear(datosBase);

    expect(citaModel.crear.mock.calls[0][0].examenes).toEqual([1, 2]);
  });

  it('rechaza una hora con formato inválido', async () => {
    await expect(
      citaService.crear({ ...datosBase, hora: '25:00' }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('Reprogramación de citas', () => {
  beforeEach(() => {
    citaModel.buscarPorId.mockResolvedValue(citaCreada());
  });

  it('permite mover la cita a otra fecha vigente', async () => {
    const nuevaFecha = fechas.sumarDias(HOY, 5);

    await citaService.actualizar(100, { fecha: nuevaFecha });

    expect(citaModel.actualizar).toHaveBeenCalledWith(
      100,
      expect.objectContaining({ fecha: nuevaFecha }),
      expect.any(Function),
    );
  });

  it('rechaza moverla más allá del vencimiento', async () => {
    await expect(
      citaService.actualizar(100, { fecha: fechas.sumarDias(VENCIMIENTO, 1) }),
    ).rejects.toMatchObject({ statusCode: 422, details: { motivo: 'FUERA_DE_VIGENCIA' } });
  });

  describe('con cita en el IGSS antes del vencimiento', () => {
    // La orden vence en 30 días, pero el paciente va al IGSS en 10: los
    // resultados tienen que estar antes, así que el límite es el día 9.
    const CITA_IGSS = fechas.sumarDias(HOY, 10);
    const VISPERA = fechas.sumarDias(CITA_IGSS, -1);

    beforeEach(() => {
      ordenModel.buscarPorId.mockResolvedValue(ordenDePrueba({ fecha_cita_igss: CITA_IGSS }));
    });

    it('deja moverla hasta la víspera de la cita del IGSS', async () => {
      await citaService.actualizar(100, { fecha: VISPERA });

      expect(citaModel.actualizar).toHaveBeenCalledWith(
        100,
        expect.objectContaining({ fecha: VISPERA }),
        expect.any(Function),
      );
    });

    it.each([
      ['el mismo día de la cita del IGSS', 0],
      ['después de la cita del IGSS, aunque la orden siga vigente', 5],
    ])('rechaza moverla %s', async (_caso, diasDespues) => {
      await expect(
        citaService.actualizar(100, { fecha: fechas.sumarDias(CITA_IGSS, diasDespues) }),
      ).rejects.toMatchObject({
        statusCode: 422,
        details: { motivo: 'DESPUES_DE_CITA_IGSS', fecha_limite: VISPERA },
      });
      expect(citaModel.actualizar).not.toHaveBeenCalled();
    });

    it('al reagendar una cancelada también respeta la cita del IGSS', async () => {
      citaModel.buscarPorId.mockResolvedValue(
        citaCreada({ estado: 'CANCELADA', estado_nombre: 'Cancelada', ocupa_cupo: 0 }),
      );

      await expect(
        citaService.actualizar(100, { fecha: fechas.sumarDias(CITA_IGSS, 3) }),
      ).rejects.toMatchObject({ details: { motivo: 'DESPUES_DE_CITA_IGSS' } });
    });

    it('las fechas que propone al rechazar no pasan de la víspera', async () => {
      const error = await citaService
        .actualizar(100, { fecha: fechas.sumarDias(CITA_IGSS, 5) })
        .catch((problema) => problema);

      expect(error.details.fechas_sugeridas.length).toBeGreaterThan(0);
      error.details.fechas_sugeridas.forEach(({ fecha }) =>
        expect(fechas.comparar(fecha, VISPERA)).toBeLessThanOrEqual(0),
      );
    });
  });

  it('no cuenta dos veces la propia cita al cambiar solo la hora', async () => {
    // El día está justo en el límite, pero uno de esos lugares es esta cita.
    citaModel.contarOcupacion.mockResolvedValue(LIMITE_DIARIO);

    await citaService.actualizar(100, { fecha: MANANA, hora: '10:00' });

    expect(citaModel.actualizar).toHaveBeenCalled();
  });

  it('vuelve a comprobar el cupo dentro de la transacción al mover la cita', async () => {
    const otroDia = fechas.sumarDias(HOY, 7);

    // Pasa la validación previa, pero el día se llena antes del UPDATE.
    citaModel.contarOcupacion
      .mockResolvedValueOnce(LIMITE_DIARIO - 1)
      .mockResolvedValue(LIMITE_DIARIO);

    await expect(citaService.actualizar(100, { fecha: otroDia })).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  describe('el recordatorio sigue a la cita', () => {
    /** Recordatorio ya enviado con la fecha vieja. */
    function recordatorioEnviado() {
      recordatorioModel.buscarPorCita.mockResolvedValue({
        id: 7,
        cita_id: 100,
        estado: 'ENVIADO',
      });
    }

    it('reabre y rehace el aviso ya enviado al mover la cita de día', async () => {
      recordatorioEnviado();
      const nuevaFecha = fechas.sumarDias(HOY, 5);

      await citaService.actualizar(100, { fecha: nuevaFecha });

      expect(recordatorioModel.reabrir).toHaveBeenCalledWith(7);
      expect(recordatorioModel.crearSiNoExiste).toHaveBeenCalledWith(
        expect.objectContaining({
          citaId: 100,
          // La víspera de la fecha nueva, no de la vieja.
          programadoPara: `${fechas.sumarDias(nuevaFecha, -1)} 08:00:00`,
        }),
      );
    });

    it('el mensaje rehecho lleva la fecha nueva', async () => {
      recordatorioEnviado();
      const nuevaFecha = fechas.sumarDias(HOY, 5);

      await citaService.actualizar(100, { fecha: nuevaFecha });

      const { mensaje } = recordatorioModel.crearSiNoExiste.mock.calls[0][0];
      expect(mensaje).toContain(fechas.aFormatoLocal(nuevaFecha));
      expect(mensaje).not.toContain(fechas.aFormatoLocal(MANANA));
    });

    it('también lo rehace si solo cambia la hora', async () => {
      recordatorioEnviado();

      await citaService.actualizar(100, { hora: '15:00' });

      expect(recordatorioModel.crearSiNoExiste).toHaveBeenCalledWith(
        expect.objectContaining({ mensaje: expect.stringContaining('03:00 PM') }),
      );
    });

    it('no toca nada si solo se editan las notas', async () => {
      recordatorioEnviado();

      await citaService.actualizar(100, { notas: 'Viene acompañado' });

      expect(recordatorioModel.reabrir).not.toHaveBeenCalled();
      expect(recordatorioModel.crearSiNoExiste).not.toHaveBeenCalled();
    });

    it('no hace nada si esa cita todavía no tenía recordatorio', async () => {
      await citaService.actualizar(100, { fecha: fechas.sumarDias(HOY, 5) });

      expect(recordatorioModel.crearSiNoExiste).not.toHaveBeenCalled();
    });
  });

  it.each(['ATENDIDA', 'NO_ASISTIO'])('no permite modificar una cita %s', async (estado) => {
    citaModel.buscarPorId.mockResolvedValue(
      citaCreada({ estado, estado_nombre: estado, es_final: 1 }),
    );

    await expect(citaService.actualizar(100, { hora: '10:00' })).rejects.toMatchObject({
      statusCode: 409,
    });
  });
});

describe('Editar los exámenes de una cita', () => {
  const examenModel = require('../models/examen.model');

  beforeEach(() => {
    citaModel.buscarPorId.mockResolvedValue(citaCreada());
    citaModel.actualizar.mockImplementation(async (id, cambios) => citaCreada(cambios));
  });

  it('acepta los de la orden sin tocarla', async () => {
    await citaService.actualizar(100, { examenes: [2] });

    expect(citaModel.actualizar).toHaveBeenCalledWith(100, { examenes: [2] }, null);
    expect(ordenModel.actualizar).not.toHaveBeenCalled();
  });

  it('agrega a la orden un examen que no traía', async () => {
    examenModel.listarPorIds.mockResolvedValue([{ id: 7, nombre: 'Orina', activo: 1 }]);

    await citaService.actualizar(100, { examenes: [1, 7] });

    expect(ordenModel.actualizar).toHaveBeenCalledWith(10, { examenes: [1, 2, 7] });
    expect(citaModel.actualizar).toHaveBeenCalledWith(100, { examenes: [1, 7] }, null);
  });

  it('rechaza un examen nuevo que está inactivo', async () => {
    examenModel.listarPorIds.mockResolvedValue([{ id: 7, nombre: 'Orina', activo: 0 }]);

    await expect(citaService.actualizar(100, { examenes: [7] })).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(citaModel.actualizar).not.toHaveBeenCalled();
  });
});

describe('Reagendar una cita cancelada', () => {
  /** Una cancelada no ocupa cupo: es lo que cambia al reactivarla. */
  function citaCancelada(cambios = {}) {
    return citaCreada({
      estado: 'CANCELADA',
      estado_nombre: 'Cancelada',
      es_final: 1,
      ocupa_cupo: 0,
      ...cambios,
    });
  }

  beforeEach(() => {
    citaModel.buscarPorId.mockResolvedValue(citaCancelada());
  });

  it('permite darle fecha nueva y la devuelve a pendiente', async () => {
    const nuevaFecha = fechas.sumarDias(HOY, 5);

    await citaService.actualizar(100, { fecha: nuevaFecha, hora: '11:00' });

    expect(citaModel.actualizar).toHaveBeenCalledWith(
      100,
      expect.objectContaining({ fecha: nuevaFecha, hora: '11:00:00', estadoId: 1 }),
      expect.any(Function),
    );
  });

  it('revalida el cupo aunque solo cambie la hora, porque vuelve a ocuparlo', async () => {
    citaModel.contarOcupacion.mockResolvedValue(LIMITE_DIARIO);

    await expect(citaService.actualizar(100, { hora: '11:00' })).rejects.toMatchObject({
      statusCode: 409,
      details: { motivo: 'LIMITE_DIARIO_ALCANZADO' },
    });
  });

  it('rechaza reagendarla más allá del vencimiento de la orden', async () => {
    await expect(
      citaService.actualizar(100, { fecha: fechas.sumarDias(VENCIMIENTO, 1) }),
    ).rejects.toMatchObject({ statusCode: 422, details: { motivo: 'FUERA_DE_VIGENCIA' } });
  });

  it('rechaza si el paciente ya tiene otra cita activa ese mismo día', async () => {
    citaModel.existeCitaActiva.mockResolvedValue(true);

    await expect(citaService.actualizar(100, { hora: '11:00' })).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('editar solo las notas no la reactiva ni toca el cupo', async () => {
    await citaService.actualizar(100, { notas: 'Reprogramar la próxima semana' });

    expect(citaModel.actualizar).toHaveBeenCalledWith(
      100,
      { notas: 'Reprogramar la próxima semana' },
      null,
    );
  });
});

/**
 * Es la única acción del sistema que no se puede deshacer: la cancelada se
 * reactiva, el paciente y el examen se reactivan, esto no. Por eso pide la
 * contraseña de quien tiene la sesión abierta, y por eso se comprueba en el
 * servidor y no solo en el diálogo del navegador.
 */
describe('Eliminación definitiva', () => {
  const CONFIRMACION = { usuarioId: 7, contrasena: 'Laboratorio2026' };

  it('borra la cita y devuelve su identificador', async () => {
    citaModel.buscarPorId.mockResolvedValue(citaCreada());
    citaModel.eliminar.mockResolvedValue(true);

    await expect(citaService.eliminar(100, CONFIRMACION)).resolves.toEqual({
      id: 100,
      eliminada: true,
    });
    expect(citaModel.eliminar).toHaveBeenCalledWith(100);
  });

  it('responde 404 si la cita no existe', async () => {
    citaModel.buscarPorId.mockResolvedValue(null);

    await expect(citaService.eliminar(999, CONFIRMACION)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(citaModel.eliminar).not.toHaveBeenCalled();
  });

  it('no borra nada si la contraseña no es la correcta', async () => {
    password.verificar.mockResolvedValue(false);
    citaModel.buscarPorId.mockResolvedValue(citaCreada());

    await expect(
      citaService.eliminar(100, { usuarioId: 7, contrasena: 'equivocada' }),
    ).rejects.toMatchObject({ statusCode: 401 });

    expect(citaModel.eliminar).not.toHaveBeenCalled();
  });

  it.each([[undefined], [''], [null]])(
    'no borra nada si no se envía contraseña (%p)',
    async (contrasena) => {
      password.verificar.mockResolvedValue(false);
      citaModel.buscarPorId.mockResolvedValue(citaCreada());

      await expect(citaService.eliminar(100, { usuarioId: 7, contrasena })).rejects.toMatchObject({
        statusCode: 401,
      });

      expect(citaModel.eliminar).not.toHaveBeenCalled();
    },
  );

  /** La cuenta pudo desactivarse mientras la pestaña seguía abierta. */
  it('no borra nada si la cuenta de la sesión ya no está activa', async () => {
    usuarioModel.buscarPorId.mockResolvedValue({ id: 7, usuario: 'ana', activo: 0 });
    citaModel.buscarPorId.mockResolvedValue(citaCreada());

    await expect(citaService.eliminar(100, CONFIRMACION)).rejects.toMatchObject({
      statusCode: 401,
    });

    expect(citaModel.eliminar).not.toHaveBeenCalled();
  });

  /** La contraseña se comprueba antes de tocar la base. */
  it('comprueba la identidad antes de buscar la cita', async () => {
    password.verificar.mockResolvedValue(false);

    await expect(citaService.eliminar(100, CONFIRMACION)).rejects.toMatchObject({
      statusCode: 401,
    });

    expect(citaModel.buscarPorId).not.toHaveBeenCalled();
  });
});

describe('Estados de la cita', () => {
  it.each([
    ['PENDIENTE', 'CONFIRMADA'],
    ['PENDIENTE', 'CANCELADA'],
    ['CONFIRMADA', 'ATENDIDA'],
    ['CONFIRMADA', 'NO_ASISTIO'],
    ['CONFIRMADA', 'CANCELADA'],
    ['CANCELADA', 'PENDIENTE'],
    ['CANCELADA', 'CONFIRMADA'],
    // Corrige el cierre automático cuando el paciente sí vino.
    ['NO_ASISTIO', 'ATENDIDA'],
  ])('permite pasar de %s a %s', async (desde, hacia) => {
    citaModel.buscarPorId.mockResolvedValue(
      citaCreada({
        estado: desde,
        estado_nombre: desde,
        ocupa_cupo: desde === 'CANCELADA' ? 0 : 1,
      }),
    );

    await citaService.cambiarEstado(100, hacia);

    expect(citaModel.actualizar).toHaveBeenCalled();
  });

  it('al reactivar una cancelada comprueba que el día siga teniendo cupo', async () => {
    citaModel.buscarPorId.mockResolvedValue(
      citaCreada({ estado: 'CANCELADA', estado_nombre: 'Cancelada', ocupa_cupo: 0 }),
    );
    citaModel.contarOcupacion.mockResolvedValue(LIMITE_DIARIO);

    await expect(citaService.cambiarEstado(100, 'CONFIRMADA')).rejects.toMatchObject({
      statusCode: 409,
      details: { motivo: 'LIMITE_DIARIO_ALCANZADO' },
    });

    expect(citaModel.actualizar).not.toHaveBeenCalled();
  });

  it.each([
    ['ATENDIDA', 'CANCELADA'],
    ['CANCELADA', 'ATENDIDA'],
    ['NO_ASISTIO', 'PENDIENTE'],
    ['NO_ASISTIO', 'CANCELADA'],
  ])('no permite pasar de %s a %s', async (desde, hacia) => {
    citaModel.buscarPorId.mockResolvedValue(citaCreada({ estado: desde, estado_nombre: desde }));

    await expect(citaService.cambiarEstado(100, hacia)).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('rechaza cambiar al estado en el que ya está', async () => {
    citaModel.buscarPorId.mockResolvedValue(citaCreada());

    await expect(citaService.cambiarEstado(100, 'PENDIENTE')).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('guarda el motivo al cancelar', async () => {
    citaModel.buscarPorId.mockResolvedValue(citaCreada({ notas: null }));

    await citaService.cambiarEstado(100, 'CANCELADA', { motivo: 'El paciente no puede asistir' });

    expect(citaModel.actualizar.mock.calls[0][1].notas).toContain('El paciente no puede asistir');
  });
});

describe('Cierre de las citas pasadas', () => {
  it('marca «No asistió» lo que quedó abierto antes de hoy', async () => {
    citaModel.marcarNoAsistidasAntesDe.mockResolvedValue(3);

    const cerradas = await citaService.cerrarCitasPasadas();

    // Hoy no: el paciente todavía puede llegar.
    expect(citaModel.marcarNoAsistidasAntesDe).toHaveBeenCalledWith(HOY);
    expect(cerradas).toBe(3);
  });
});

describe('Historial de citas del paciente', () => {
  it('devuelve todas sus citas, de la más reciente a la más antigua', async () => {
    const historial = [
      citaCreada({ id: 102, fecha: MANANA }),
      citaCreada({ id: 101, fecha: AYER, estado: 'ATENDIDA', estado_nombre: 'Atendida' }),
      citaCreada({ id: 100, fecha: fechas.sumarDias(HOY, -30), estado: 'CANCELADA' }),
    ];
    citaModel.listarPorPaciente.mockResolvedValue(historial);

    const citas = await citaService.historialDePaciente(1);

    expect(citaModel.listarPorPaciente).toHaveBeenCalledWith(1);
    expect(citas.map((c) => c.id)).toEqual([102, 101, 100]);
  });

  it('incluye las canceladas y las atendidas: el historial no se filtra', async () => {
    citaModel.listarPorPaciente.mockResolvedValue([
      citaCreada({ estado: 'CANCELADA' }),
      citaCreada({ estado: 'ATENDIDA' }),
    ]);

    const citas = await citaService.historialDePaciente(1);

    expect(citas.map((c) => c.estado)).toEqual(['CANCELADA', 'ATENDIDA']);
  });

  it('responde 404 si el paciente no existe y no consulta sus citas', async () => {
    pacienteModel.buscarPorId.mockResolvedValue(null);

    await expect(citaService.historialDePaciente(999)).rejects.toMatchObject({
      statusCode: 404,
    });

    expect(citaModel.listarPorPaciente).not.toHaveBeenCalled();
  });
});
