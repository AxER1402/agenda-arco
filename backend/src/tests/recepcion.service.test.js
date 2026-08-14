/**
 * Recepción en el mostrador: paciente + orden del IGSS + cita en una sola
 * operación.
 *
 * Se simulan solo los modelos, así que las reglas de vigencia, cupo y DPI se
 * ejercitan de verdad.
 */
jest.mock('../models/cita.model');
jest.mock('../models/orden.model');
jest.mock('../models/paciente.model');
jest.mock('../models/configuracion.model');
jest.mock('../models/examen.model');

const citaModel = require('../models/cita.model');
const ordenModel = require('../models/orden.model');
const pacienteModel = require('../models/paciente.model');
const configuracionModel = require('../models/configuracion.model');
const examenModel = require('../models/examen.model');

const recepcionService = require('../services/recepcion.service');
const fechas = require('../utils/fechas');

const HOY = fechas.hoy();
const MANANA = fechas.sumarDias(HOY, 1);
const LIMITE_DIARIO = 40;

const EXAMENES = [
  { id: 1, codigo: 'HEM-001', nombre: 'Hematología completa', activo: 1 },
  { id: 2, codigo: 'QUI-001', nombre: 'Glucosa', activo: 1 },
];

const PACIENTE_NUEVO = {
  nombreCompleto: 'Ana López',
  telefono: '55512345',
  dpi: '1111111111111',
};

/** Datos mínimos de una recepción válida. */
function datosBase(cambios = {}) {
  return {
    paciente: { ...PACIENTE_NUEVO },
    fechaRecepcion: HOY,
    examenes: [1, 2],
    fecha: MANANA,
    hora: '09:00',
    ...cambios,
  };
}

beforeEach(() => {
  configuracionModel.obtener.mockImplementation(async (clave) => {
    const valores = {
      limite_diario_pacientes: String(LIMITE_DIARIO),
      vigencia_orden_meses: '3',
      dias_laborables: '1,2,3,4,5,6,7',
      hora_apertura: '07:00',
      hora_cierre: '17:00',
      intervalo_citas_minutos: '15',
    };
    return valores[clave] ? { clave, valor: valores[clave] } : null;
  });

  examenModel.listarPorIds.mockResolvedValue(EXAMENES);

  pacienteModel.buscarPorTelefono.mockResolvedValue([]);
  pacienteModel.buscarPorDpi.mockResolvedValue([]);
  pacienteModel.crear.mockImplementation(async (datos) => ({
    id: 77,
    nombre_completo: datos.nombreCompleto,
    telefono: datos.telefono,
    dpi: datos.dpi,
    activo: 1,
  }));
  pacienteModel.buscarPorId.mockResolvedValue({ id: 77, nombre_completo: 'Ana López', activo: 1 });
  pacienteModel.eliminar.mockResolvedValue(true);

  ordenModel.crear.mockImplementation(async (datos) => ({
    id: 55,
    paciente_id: datos.pacienteId,
    fecha_entrega: datos.fechaEntrega,
    fecha_vencimiento: datos.fechaVencimiento,
    examenes: EXAMENES,
  }));
  ordenModel.buscarPorId.mockImplementation(async () => ({
    id: 55,
    paciente_id: 77,
    fecha_entrega: HOY,
    fecha_vencimiento: fechas.sumarMeses(HOY, 3),
    examenes: EXAMENES,
  }));
  ordenModel.eliminar.mockResolvedValue(true);

  citaModel.contarOcupacion.mockResolvedValue(0);
  citaModel.contarOcupacionPorRango.mockResolvedValue(new Map());
  citaModel.existeCitaActiva.mockResolvedValue(false);
  citaModel.buscarEstadoPorCodigo.mockResolvedValue({ id: 1, codigo: 'PENDIENTE' });
  citaModel.crear.mockImplementation(async (datos, verificarCupo) => {
    verificarCupo(await citaModel.contarOcupacion(datos.fecha));
    return { id: 100, ...datos, estado: 'PENDIENTE' };
  });
});

describe('Recepción de un paciente nuevo', () => {
  it('registra paciente, orden y cita de una sola vez', async () => {
    const resultado = await recepcionService.recibir(datosBase(), 1);

    expect(resultado.paciente_registrado).toBe(true);
    expect(resultado.paciente.id).toBe(77);
    expect(resultado.orden.id).toBe(55);
    expect(resultado.cita.id).toBe(100);
  });

  it('calcula el vencimiento de la orden desde la fecha de recepción', async () => {
    await recepcionService.recibir(datosBase({ fechaRecepcion: HOY }), 1);

    expect(ordenModel.crear).toHaveBeenCalledWith(
      expect.objectContaining({
        fechaEntrega: HOY,
        fechaVencimiento: fechas.sumarMeses(HOY, 3),
      }),
    );
  });

  it('guarda el DPI normalizado', async () => {
    await recepcionService.recibir(
      datosBase({ paciente: { ...PACIENTE_NUEVO, dpi: '1111 11111 1111' } }),
      1,
    );

    expect(pacienteModel.crear).toHaveBeenCalledWith(
      expect.objectContaining({ dpi: '1111111111111' }),
    );
  });

  it('rechaza un DPI incompleto antes de tocar la base', async () => {
    await expect(
      recepcionService.recibir(datosBase({ paciente: { ...PACIENTE_NUEVO, dpi: '1111111111' } }), 1),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(pacienteModel.crear).not.toHaveBeenCalled();
    expect(ordenModel.crear).not.toHaveBeenCalled();
  });

  it('acepta que llegue sin DPI', async () => {
    await recepcionService.recibir(datosBase({ paciente: { ...PACIENTE_NUEVO, dpi: '' } }), 1);

    expect(pacienteModel.crear).toHaveBeenCalledWith(expect.objectContaining({ dpi: null }));
  });

  it('avisa cuando la cita cae el último día de vigencia', async () => {
    const vencimiento = fechas.sumarMeses(HOY, 3);

    const { avisos } = await recepcionService.recibir(datosBase({ fecha: vencimiento }), 1);

    expect(avisos.join(' ')).toContain('último día de vigencia');
  });

  it('no avisa nada raro por agendar unos días antes del vencimiento', async () => {
    const casiVencida = fechas.sumarDias(fechas.sumarMeses(HOY, 3), -2);

    const { avisos } = await recepcionService.recibir(datosBase({ fecha: casiVencida }), 1);

    expect(avisos).toEqual([]);
  });

  it('avisa si el DPI ya estaba registrado, pero no bloquea', async () => {
    pacienteModel.buscarPorDpi.mockResolvedValue([{ id: 3, nombre_completo: 'Ana L. López' }]);

    const resultado = await recepcionService.recibir(datosBase(), 1);

    expect(resultado.cita).toBeDefined();
    expect(resultado.avisos.join(' ')).toContain('Ana L. López');
  });
});

describe('Confirmación de WhatsApp en el mostrador', () => {
  it('guarda que el número sí tiene WhatsApp', async () => {
    await recepcionService.recibir(datosBase({ tieneWhatsapp: true }), 1);

    expect(pacienteModel.crear).toHaveBeenCalledWith(
      expect.objectContaining({ tieneWhatsapp: true }),
    );
  });

  it('guarda que no lo tiene, que es lo que obliga a llamar', async () => {
    await recepcionService.recibir(datosBase({ tieneWhatsapp: false }), 1);

    expect(pacienteModel.crear).toHaveBeenCalledWith(
      expect.objectContaining({ tieneWhatsapp: false }),
    );
  });

  it('lo deja en desconocido si no se preguntó', async () => {
    await recepcionService.recibir(datosBase(), 1);

    expect(pacienteModel.crear).toHaveBeenCalledWith(
      expect.objectContaining({ tieneWhatsapp: null }),
    );
  });

  it('actualiza el dato de un paciente ya registrado', async () => {
    pacienteModel.buscarPorId.mockResolvedValue({ id: 77, activo: 1, tiene_whatsapp: null });
    pacienteModel.actualizar.mockResolvedValue({ id: 77, activo: 1, tiene_whatsapp: 0 });

    await recepcionService.recibir(
      datosBase({ paciente: undefined, pacienteId: 77, tieneWhatsapp: false }),
      1,
    );

    expect(pacienteModel.actualizar).toHaveBeenCalledWith(77, { tieneWhatsapp: false });
  });

  it('no reescribe el dato si ya coincidía', async () => {
    pacienteModel.buscarPorId.mockResolvedValue({ id: 77, activo: 1, tiene_whatsapp: 1 });

    await recepcionService.recibir(
      datosBase({ paciente: undefined, pacienteId: 77, tieneWhatsapp: true }),
      1,
    );

    expect(pacienteModel.actualizar).not.toHaveBeenCalled();
  });
});

describe('Recepción de un paciente ya registrado', () => {
  it('no vuelve a crearlo', async () => {
    const resultado = await recepcionService.recibir(
      datosBase({ paciente: undefined, pacienteId: 77 }),
      1,
    );

    expect(pacienteModel.crear).not.toHaveBeenCalled();
    expect(resultado.paciente_registrado).toBe(false);
    expect(resultado.cita).toBeDefined();
  });

  it('rechaza si ya tiene una cita activa ese día', async () => {
    citaModel.existeCitaActiva.mockResolvedValue(true);

    await expect(
      recepcionService.recibir(datosBase({ paciente: undefined, pacienteId: 77 }), 1),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(ordenModel.crear).not.toHaveBeenCalled();
  });

  it('rechaza si está inactivo', async () => {
    pacienteModel.buscarPorId.mockResolvedValue({ id: 77, activo: 0 });

    await expect(
      recepcionService.recibir(datosBase({ paciente: undefined, pacienteId: 77 }), 1),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('Validaciones antes de escribir', () => {
  it('rechaza una cita posterior al vencimiento y sugiere fechas', async () => {
    const fueraDeVigencia = fechas.sumarDias(fechas.sumarMeses(HOY, 3), 1);

    const error = await recepcionService
      .recibir(datosBase({ fecha: fueraDeVigencia }))
      .catch((e) => e);

    expect(error.statusCode).toBe(422);
    expect(error.details.motivo).toBe('FUERA_DE_VIGENCIA');
    expect(error.details.fechas_sugeridas.length).toBeGreaterThan(0);
    expect(pacienteModel.crear).not.toHaveBeenCalled();
  });

  it('rechaza el día lleno sin haber creado nada', async () => {
    citaModel.contarOcupacion.mockResolvedValue(LIMITE_DIARIO);

    await expect(recepcionService.recibir(datosBase())).rejects.toMatchObject({
      statusCode: 409,
      details: { motivo: 'LIMITE_DIARIO_ALCANZADO' },
    });

    expect(pacienteModel.crear).not.toHaveBeenCalled();
    expect(ordenModel.crear).not.toHaveBeenCalled();
  });

  it('rechaza una fecha de recepción futura', async () => {
    await expect(
      recepcionService.recibir(datosBase({ fechaRecepcion: MANANA })),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rechaza si no se indica ningún examen', async () => {
    await expect(recepcionService.recibir(datosBase({ examenes: [] }))).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('rechaza un examen que no existe', async () => {
    examenModel.listarPorIds.mockResolvedValue([EXAMENES[0]]);

    await expect(recepcionService.recibir(datosBase({ examenes: [1, 999] }))).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});

describe('Deshacer si la cita falla al final', () => {
  it('borra la orden y el paciente recién creados', async () => {
    // Pasa la validación previa y el día se llena justo antes del INSERT.
    citaModel.contarOcupacion
      .mockResolvedValueOnce(LIMITE_DIARIO - 1)
      .mockResolvedValue(LIMITE_DIARIO);

    await expect(recepcionService.recibir(datosBase(), 1)).rejects.toMatchObject({
      statusCode: 409,
    });

    expect(ordenModel.eliminar).toHaveBeenCalledWith(55);
    expect(pacienteModel.eliminar).toHaveBeenCalledWith(77);
  });

  it('no borra a un paciente que ya existía', async () => {
    citaModel.contarOcupacion
      .mockResolvedValueOnce(LIMITE_DIARIO - 1)
      .mockResolvedValue(LIMITE_DIARIO);

    await expect(
      recepcionService.recibir(datosBase({ paciente: undefined, pacienteId: 77 }), 1),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(ordenModel.eliminar).toHaveBeenCalledWith(55);
    expect(pacienteModel.eliminar).not.toHaveBeenCalled();
  });
});
