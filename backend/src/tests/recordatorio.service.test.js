/**
 * Recordatorios por WhatsApp (requisitos 18 y 19).
 *
 * El cliente de WhatsApp está simulado: ninguna prueba contacta con el
 * whatsapp-service ni con una cuenta real (requisito 23).
 */
jest.mock('../models/recordatorio.model');
jest.mock('../models/cita.model');
jest.mock('../models/paciente.model');
jest.mock('../models/configuracion.model');
jest.mock('../services/whatsapp.client');

const recordatorioModel = require('../models/recordatorio.model');
const citaModel = require('../models/cita.model');
const pacienteModel = require('../models/paciente.model');
const configuracionModel = require('../models/configuracion.model');
const whatsappClient = require('../services/whatsapp.client');

const recordatorioService = require('../services/recordatorio.service');
const fechas = require('../utils/fechas');

const HOY = fechas.hoy();
const MANANA = fechas.sumarDias(HOY, 1);

function citaDePrueba(cambios = {}) {
  return {
    id: 100,
    paciente_id: 1,
    paciente_nombre: 'Juan Pérez',
    paciente_telefono: '55555555',
    fecha: MANANA,
    hora: '09:00:00',
    examenes: [{ id: 1, nombre: 'Hematología completa' }],
    ...cambios,
  };
}

function recordatorioDePrueba(cambios = {}) {
  return {
    id: 7,
    cita_id: 100,
    paciente_id: 1,
    telefono: '55555555',
    mensaje: 'mensaje de prueba',
    estado: 'PENDIENTE',
    ...cambios,
  };
}

/** Configuración simulada, distinta según la clave que se pida. */
function configurar({ horaRecordatorios = '08:00', plantilla, imagen } = {}) {
  const valores = {
    nombre_laboratorio: 'El Arco Laboratorios',
    hora_recordatorios: horaRecordatorios,
    plantilla_recordatorio: plantilla,
    imagen_recordatorio: imagen,
  };

  configuracionModel.obtener.mockImplementation(async (clave) =>
    valores[clave] ? { clave, valor: valores[clave] } : null,
  );
}

beforeEach(() => {
  configurar();

  recordatorioModel.crearSiNoExiste.mockImplementation(async (datos) =>
    recordatorioDePrueba({ mensaje: datos.mensaje, telefono: datos.telefono }),
  );
  recordatorioModel.marcarEnviado.mockImplementation(async (id) =>
    recordatorioDePrueba({ id, estado: 'ENVIADO' }),
  );
  recordatorioModel.marcarFallido.mockImplementation(async (id, error) =>
    recordatorioDePrueba({ id, estado: 'FALLIDO', error_mensaje: error }),
  );
  recordatorioModel.reabrir.mockImplementation(async (id) => recordatorioDePrueba({ id }));
});

// ---------------------------------------------------------------------------

describe('generarMensaje', () => {
  it('incluye nombre, fecha, hora y examen', () => {
    const mensaje = recordatorioService.generarMensaje(
      citaDePrueba({ fecha: '2026-08-10' }),
      'El Arco Laboratorios',
    );

    expect(mensaje).toContain('Juan Pérez');
    expect(mensaje).toContain('El Arco Laboratorios');
    expect(mensaje).toContain('Fecha: 10/08/2026');
    expect(mensaje).toContain('Hora: 09:00 AM');
    expect(mensaje).toContain('Examen: Hematología completa');
    expect(mensaje).toContain('Agradecemos su puntualidad.');
  });

  it('pluraliza cuando hay varios exámenes', () => {
    const mensaje = recordatorioService.generarMensaje(
      citaDePrueba({
        examenes: [{ nombre: 'Hematología completa' }, { nombre: 'Glucosa' }],
      }),
    );

    expect(mensaje).toContain('Exámenes: Hematología completa, Glucosa');
  });

  it('omite la línea de exámenes si la cita no tiene ninguno', () => {
    const mensaje = recordatorioService.generarMensaje(citaDePrueba({ examenes: [] }));

    expect(mensaje).not.toContain('Examen');
  });
});

/**
 * El texto lo redacta el laboratorio desde Configuración: el sistema solo
 * rellena los datos de la cita entre llaves.
 */
describe('mensaje redactado por el laboratorio', () => {
  it('sustituye los datos de la cita en la plantilla', () => {
    const mensaje = recordatorioService.generarMensaje(
      citaDePrueba({ fecha: '2026-08-10' }),
      'Laboratorios El Arco',
      'Hola {paciente}, le esperamos en {laboratorio} el {fecha} a las {hora}.',
    );

    expect(mensaje).toBe(
      'Hola Juan Pérez, le esperamos en Laboratorios El Arco el 10/08/2026 a las 09:00 AM.',
    );
  });

  it('deja el marcador de exámenes como una lista separada por comas', () => {
    const mensaje = recordatorioService.generarMensaje(
      citaDePrueba({ examenes: [{ nombre: 'Glucosa' }, { nombre: 'Orina completa' }] }),
      'El Arco Laboratorios',
      'Le corresponden: {examenes}.',
    );

    expect(mensaje).toBe('Le corresponden: Glucosa, Orina completa.');
  });

  /**
   * Sin esto, una cita sin exámenes dejaría en el mensaje una línea con unos
   * dos puntos sueltos.
   */
  it('borra la línea cuyos datos quedaron todos vacíos', () => {
    const mensaje = recordatorioService.generarMensaje(
      citaDePrueba({ examenes: [], fecha: '2026-08-10' }),
      'El Arco Laboratorios',
      'Su cita es el {fecha}.\n{etiqueta_examenes}: {examenes}\nGracias.',
    );

    expect(mensaje).toBe('Su cita es el 10/08/2026.\nGracias.');
  });

  it('conserva la línea que tiene texto propio aunque el dato venga vacío', () => {
    const mensaje = recordatorioService.generarMensaje(
      citaDePrueba({ examenes: [] }),
      'El Arco Laboratorios',
      'Exámenes indicados: {examenes}',
    );

    expect(mensaje).toBe('Exámenes indicados: ');
  });

  it('usa la plantilla guardada al preparar los recordatorios', async () => {
    configurar({ plantilla: 'Recuerde su cita del {fecha}. — {laboratorio}' });
    citaModel.listarParaRecordatorio.mockResolvedValue([citaDePrueba()]);

    await recordatorioService.prepararParaFecha(MANANA);

    expect(recordatorioModel.crearSiNoExiste).toHaveBeenCalledWith(
      expect.objectContaining({
        mensaje: `Recuerde su cita del ${fechas.aFormatoLocal(MANANA)}. — El Arco Laboratorios`,
      }),
    );
  });

  it('vuelve a la plantilla del sistema si la guardada no sirve', async () => {
    // Un marcador inexistente: alguien tocó la tabla a mano.
    configurar({ plantilla: 'Hola {no_existe}' });
    citaModel.listarParaRecordatorio.mockResolvedValue([citaDePrueba()]);

    await recordatorioService.prepararParaFecha(MANANA);

    expect(recordatorioModel.crearSiNoExiste).toHaveBeenCalledWith(
      expect.objectContaining({ mensaje: expect.stringContaining('Agradecemos su puntualidad.') }),
    );
  });
});

describe('imagen adjunta', () => {
  const IMAGEN = 'data:image/png;base64,iVBORw0KGgo=';

  it('acompaña al mensaje cuando el laboratorio configuró una', async () => {
    configurar({ imagen: IMAGEN });
    whatsappClient.enviarMensaje.mockResolvedValue({ enviado: true });

    await recordatorioService.enviar(recordatorioDePrueba());

    expect(whatsappClient.enviarMensaje).toHaveBeenCalledWith(
      expect.objectContaining({ imagen: IMAGEN }),
    );
  });

  it('no se envía nada si no hay imagen configurada', async () => {
    whatsappClient.enviarMensaje.mockResolvedValue({ enviado: true });

    await recordatorioService.enviar(recordatorioDePrueba());

    expect(whatsappClient.enviarMensaje).toHaveBeenCalledWith(
      expect.objectContaining({ imagen: undefined }),
    );
  });

  /** Es la misma para toda la tanda: releerla por cada envío sería absurdo. */
  it('se lee una sola vez para todos los pendientes', async () => {
    configurar({ imagen: IMAGEN });
    recordatorioModel.listarPendientes.mockResolvedValue([
      recordatorioDePrueba({ id: 1 }),
      recordatorioDePrueba({ id: 2 }),
    ]);
    whatsappClient.enviarMensaje.mockResolvedValue({ enviado: true });

    await recordatorioService.enviarPendientes();

    const lecturas = configuracionModel.obtener.mock.calls.filter(
      ([clave]) => clave === 'imagen_recordatorio',
    );

    expect(lecturas).toHaveLength(1);
    expect(whatsappClient.enviarMensaje).toHaveBeenCalledTimes(2);
  });
});

describe('obtenerPlantilla y previsualizarPlantilla', () => {
  it('devuelve el texto, la imagen y un ejemplo ya resuelto', async () => {
    configurar({ plantilla: 'Hola {paciente}, cita el {fecha}.', imagen: 'data:image/png;base64,AA==' });

    const datos = await recordatorioService.obtenerPlantilla();

    expect(datos.plantilla).toBe('Hola {paciente}, cita el {fecha}.');
    expect(datos.imagen).toBe('data:image/png;base64,AA==');
    expect(datos.marcadores).toHaveProperty('paciente');
    // El ejemplo no lleva llaves: es lo que vería el paciente.
    expect(datos.ejemplo).not.toContain('{');
  });

  it('sin imagen configurada devuelve null, no una cadena vacía', async () => {
    const datos = await recordatorioService.obtenerPlantilla();

    expect(datos.imagen).toBeNull();
  });

  it('previsualiza sin guardar nada', async () => {
    const datos = await recordatorioService.previsualizarPlantilla('Hola {paciente}.');

    expect(datos.mensaje).toBe('Hola María González.');
    expect(configuracionModel.establecer).not.toHaveBeenCalled();
  });
});

describe('guardarPlantilla', () => {
  it('rechaza un marcador que no existe y no guarda nada', async () => {
    await expect(
      recordatorioService.guardarPlantilla({ plantilla: 'Hola {telefono}' }, 1),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(configuracionModel.establecer).not.toHaveBeenCalled();
  });

  it('rechaza un archivo que no es una imagen', async () => {
    await expect(
      recordatorioService.guardarPlantilla({ imagen: 'data:application/pdf;base64,JVBERi0=' }, 1),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('guardar solo el texto no borra la imagen', async () => {
    await recordatorioService.guardarPlantilla({ plantilla: 'Hola {paciente}' }, 1);

    expect(configuracionModel.establecer).toHaveBeenCalledTimes(1);
    expect(configuracionModel.establecer).toHaveBeenCalledWith(
      'plantilla_recordatorio',
      'Hola {paciente}',
      1,
    );
  });

  it('una imagen vacía es la forma de quitarla', async () => {
    await recordatorioService.guardarPlantilla({ imagen: '' }, 1);

    expect(configuracionModel.establecer).toHaveBeenCalledWith('imagen_recordatorio', '', 1);
  });
});

describe('hora de envío configurable', () => {
  it('programa el recordatorio el día anterior, a la hora por defecto', async () => {
    citaModel.listarParaRecordatorio.mockResolvedValue([citaDePrueba()]);

    await recordatorioService.prepararParaFecha(MANANA);

    expect(recordatorioModel.crearSiNoExiste).toHaveBeenCalledWith(
      expect.objectContaining({ programadoPara: `${HOY} 08:00:00` }),
    );
  });

  it('usa la hora que configuró el laboratorio', async () => {
    configurar({ horaRecordatorios: '17:30' });
    citaModel.listarParaRecordatorio.mockResolvedValue([citaDePrueba()]);

    const resultado = await recordatorioService.prepararParaFecha(MANANA);

    expect(recordatorioModel.crearSiNoExiste).toHaveBeenCalledWith(
      expect.objectContaining({ programadoPara: `${HOY} 17:30:00` }),
    );
    expect(resultado.hora_envio).toBe('17:30');
  });

  it('vuelve a las 08:00 si el valor guardado no sirve', async () => {
    configurar({ horaRecordatorios: 'a deshoras' });
    citaModel.listarParaRecordatorio.mockResolvedValue([citaDePrueba()]);

    await recordatorioService.prepararParaFecha(MANANA);

    expect(recordatorioModel.crearSiNoExiste).toHaveBeenCalledWith(
      expect.objectContaining({ programadoPara: `${HOY} 08:00:00` }),
    );
  });
});

/**
 * El recordatorio cuelga de la CITA, no del paciente: la clave única de la
 * tabla es `cita_id`. Un paciente con varias citas recibe un aviso por cada
 * una, y haber avisado de la de un día no calla la del otro.
 */
describe('Un paciente con citas en días distintos', () => {
  const PASADO = fechas.sumarDias(HOY, 2);

  it('prepara un recordatorio por cada cita, no uno por paciente', async () => {
    // Mismo paciente (id 1), dos citas distintas.
    citaModel.listarParaRecordatorio.mockResolvedValue([
      citaDePrueba({ id: 100, fecha: MANANA }),
      citaDePrueba({ id: 200, fecha: MANANA, hora: '11:00:00' }),
    ]);

    const resultado = await recordatorioService.prepararParaFecha(MANANA);

    expect(resultado.preparados).toBe(2);
    expect(recordatorioModel.crearSiNoExiste).toHaveBeenCalledWith(
      expect.objectContaining({ citaId: 100 }),
    );
    expect(recordatorioModel.crearSiNoExiste).toHaveBeenCalledWith(
      expect.objectContaining({ citaId: 200 }),
    );
  });

  it('el aviso ya enviado de una cita no impide preparar el de la otra', async () => {
    // La cita de mañana ya tiene su recordatorio enviado; la de pasado, no.
    citaModel.listarParaRecordatorio.mockResolvedValue([
      citaDePrueba({ id: 100, fecha: PASADO, recordatorio_estado: null }),
    ]);

    const resultado = await recordatorioService.prepararParaFecha(PASADO);

    expect(resultado.preparados).toBe(1);
    expect(recordatorioModel.crearSiNoExiste).toHaveBeenCalledWith(
      expect.objectContaining({ citaId: 100 }),
    );
  });

  it('cada mensaje lleva la fecha y la hora de su propia cita', async () => {
    citaModel.listarParaRecordatorio.mockResolvedValue([
      citaDePrueba({ id: 100, fecha: '2026-08-17', hora: '07:00:00' }),
      citaDePrueba({ id: 200, fecha: '2026-08-17', hora: '15:30:00' }),
    ]);

    await recordatorioService.prepararParaFecha('2026-08-17');

    const [primero, segundo] = recordatorioModel.crearSiNoExiste.mock.calls.map(
      ([datos]) => datos.mensaje,
    );

    expect(primero).toContain('Hora: 07:00 AM');
    expect(segundo).toContain('Hora: 03:30 PM');
  });

  it('el envío manual de una cita no toca el recordatorio de la otra', async () => {
    citaModel.buscarPorId.mockResolvedValue(
      citaDePrueba({ id: 200, estado: 'PENDIENTE', estado_nombre: 'Pendiente' }),
    );
    recordatorioModel.buscarPorCita.mockResolvedValue(null);
    whatsappClient.enviarMensaje.mockResolvedValue({ enviado: true });

    await recordatorioService.enviarParaCita(200);

    expect(recordatorioModel.buscarPorCita).toHaveBeenCalledWith(200);
    expect(recordatorioModel.crearSiNoExiste).toHaveBeenCalledWith(
      expect.objectContaining({ citaId: 200 }),
    );
  });
});

describe('enviarParaCita (envío manual e inmediato)', () => {
  beforeEach(() => {
    citaModel.buscarPorId.mockResolvedValue(
      citaDePrueba({ estado: 'PENDIENTE', estado_nombre: 'Pendiente' }),
    );
    recordatorioModel.buscarPorCita.mockResolvedValue(null);
    whatsappClient.enviarMensaje.mockResolvedValue({ enviado: true });
  });

  it('genera el mensaje y lo envía sin esperar al proceso diario', async () => {
    const resultado = await recordatorioService.enviarParaCita(100);

    expect(whatsappClient.enviarMensaje).toHaveBeenCalledWith(
      expect.objectContaining({ telefono: '55555555' }),
    );
    expect(resultado.enviado).toBe(true);
    expect(resultado.paciente).toBe('Juan Pérez');
  });

  it('deja constancia del fallo cuando el número no tiene WhatsApp', async () => {
    whatsappClient.enviarMensaje.mockResolvedValue({
      enviado: false,
      motivo: 'NUMERO_SIN_WHATSAPP',
    });

    const resultado = await recordatorioService.enviarParaCita(100);

    expect(resultado.enviado).toBe(false);
    expect(pacienteModel.registrarResultadoWhatsapp).toHaveBeenCalledWith(1, false);
  });

  it('permite reenviar uno que ya se había enviado', async () => {
    recordatorioModel.buscarPorCita.mockResolvedValue(
      recordatorioDePrueba({ estado: 'ENVIADO' }),
    );

    const resultado = await recordatorioService.enviarParaCita(100);

    expect(recordatorioModel.reabrir).toHaveBeenCalledWith(7);
    expect(resultado.enviado).toBe(true);
  });

  it.each([
    ['CANCELADA', 'Cancelada'],
    ['ATENDIDA', 'Atendida'],
    ['NO_ASISTIO', 'No asistió'],
  ])('no recuerda una cita %s', async (estado, nombre) => {
    citaModel.buscarPorId.mockResolvedValue(
      citaDePrueba({ estado, estado_nombre: nombre }),
    );

    await expect(recordatorioService.enviarParaCita(100)).rejects.toMatchObject({
      statusCode: 400,
    });

    expect(whatsappClient.enviarMensaje).not.toHaveBeenCalled();
  });

  it('devuelve 404 si la cita no existe', async () => {
    citaModel.buscarPorId.mockResolvedValue(null);

    await expect(recordatorioService.enviarParaCita(999)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe('prepararParaFecha', () => {
  it('por defecto toma las citas del día siguiente', async () => {
    citaModel.listarParaRecordatorio.mockResolvedValue([citaDePrueba()]);

    const resultado = await recordatorioService.prepararParaFecha();

    expect(citaModel.listarParaRecordatorio).toHaveBeenCalledWith(MANANA);
    expect(resultado).toMatchObject({ fecha: MANANA, citas_encontradas: 1, preparados: 1 });
  });

  it('registra el recordatorio con el mensaje generado', async () => {
    citaModel.listarParaRecordatorio.mockResolvedValue([citaDePrueba()]);

    await recordatorioService.prepararParaFecha();

    expect(recordatorioModel.crearSiNoExiste).toHaveBeenCalledWith(
      expect.objectContaining({
        citaId: 100,
        telefono: '55555555',
        mensaje: expect.stringContaining('Juan Pérez'),
      }),
    );
  });

  it('no vuelve a generar el de una cita que ya recibió su recordatorio', async () => {
    citaModel.listarParaRecordatorio.mockResolvedValue([
      citaDePrueba({ recordatorio_estado: 'ENVIADO' }),
    ]);

    const resultado = await recordatorioService.prepararParaFecha();

    expect(recordatorioModel.crearSiNoExiste).not.toHaveBeenCalled();
    expect(resultado.preparados).toBe(0);
  });

  it('rechaza una fecha inválida', async () => {
    await expect(recordatorioService.prepararParaFecha('no-es-fecha')).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});

describe('envío de recordatorios', () => {
  it('marca ENVIADO cuando WhatsApp confirma el envío', async () => {
    whatsappClient.enviarMensaje.mockResolvedValue({ enviado: true, idMensaje: 'abc' });

    const resultado = await recordatorioService.enviar(recordatorioDePrueba());

    expect(resultado.estado).toBe('ENVIADO');
    expect(recordatorioModel.marcarEnviado).toHaveBeenCalledWith(7);
  });

  it('deja constancia de que el paciente sí tiene WhatsApp', async () => {
    whatsappClient.enviarMensaje.mockResolvedValue({ enviado: true });

    await recordatorioService.enviar(recordatorioDePrueba());

    expect(pacienteModel.registrarResultadoWhatsapp).toHaveBeenCalledWith(1, true);
  });

  it('marca FALLIDO y señala al paciente si el número no tiene WhatsApp', async () => {
    whatsappClient.enviarMensaje.mockResolvedValue({
      enviado: false,
      motivo: 'NUMERO_SIN_WHATSAPP',
      detalle: 'El número no está registrado en WhatsApp.',
    });

    const resultado = await recordatorioService.enviar(recordatorioDePrueba());

    expect(resultado.estado).toBe('FALLIDO');
    // El personal debe poder identificar a quién contactar por otro medio.
    expect(pacienteModel.registrarResultadoWhatsapp).toHaveBeenCalledWith(1, false);
  });

  it('marca FALLIDO sin descartar el WhatsApp del paciente si el fallo es del servicio', async () => {
    whatsappClient.enviarMensaje.mockResolvedValue({
      enviado: false,
      motivo: 'SERVICIO_NO_DISPONIBLE',
      detalle: 'No fue posible contactar con el servicio de WhatsApp.',
    });

    const resultado = await recordatorioService.enviar(recordatorioDePrueba());

    expect(resultado.estado).toBe('FALLIDO');
    // El número puede tener WhatsApp perfectamente: el que falló fue el servicio.
    expect(pacienteModel.registrarResultadoWhatsapp).not.toHaveBeenCalled();
  });

  it('guarda el motivo del fallo', async () => {
    whatsappClient.enviarMensaje.mockResolvedValue({
      enviado: false,
      motivo: 'ERROR_ENVIO',
      detalle: 'conexión perdida',
    });

    await recordatorioService.enviar(recordatorioDePrueba());

    expect(recordatorioModel.marcarFallido).toHaveBeenCalledWith(
      7,
      expect.stringContaining('ERROR_ENVIO'),
    );
  });
});

describe('enviarPendientes', () => {
  it('resume cuántos se enviaron y cuántos fallaron', async () => {
    recordatorioModel.listarPendientes.mockResolvedValue([
      recordatorioDePrueba({ id: 1 }),
      recordatorioDePrueba({ id: 2 }),
      recordatorioDePrueba({ id: 3 }),
    ]);

    whatsappClient.enviarMensaje
      .mockResolvedValueOnce({ enviado: true })
      .mockResolvedValueOnce({ enviado: false, motivo: 'NUMERO_SIN_WHATSAPP' })
      .mockResolvedValueOnce({ enviado: true });

    const resumen = await recordatorioService.enviarPendientes();

    expect(resumen).toEqual({ total: 3, enviados: 2, fallidos: 1 });
  });

  it('un fallo no interrumpe el envío de los demás', async () => {
    recordatorioModel.listarPendientes.mockResolvedValue([
      recordatorioDePrueba({ id: 1 }),
      recordatorioDePrueba({ id: 2 }),
    ]);

    whatsappClient.enviarMensaje
      .mockResolvedValueOnce({ enviado: false, motivo: 'ERROR_ENVIO' })
      .mockResolvedValueOnce({ enviado: true });

    const resumen = await recordatorioService.enviarPendientes();

    expect(resumen.enviados).toBe(1);
    expect(whatsappClient.enviarMensaje).toHaveBeenCalledTimes(2);
  });
});

describe('reintentar', () => {
  it('vuelve a intentar un recordatorio fallido', async () => {
    recordatorioModel.buscarPorId.mockResolvedValue(
      recordatorioDePrueba({ estado: 'FALLIDO' }),
    );
    whatsappClient.enviarMensaje.mockResolvedValue({ enviado: true });

    const resultado = await recordatorioService.reintentar(7);

    expect(recordatorioModel.reabrir).toHaveBeenCalledWith(7);
    expect(resultado.estado).toBe('ENVIADO');
  });

  it('no reenvía uno que ya se había enviado', async () => {
    recordatorioModel.buscarPorId.mockResolvedValue(
      recordatorioDePrueba({ estado: 'ENVIADO' }),
    );

    await expect(recordatorioService.reintentar(7)).rejects.toMatchObject({ statusCode: 400 });
    expect(whatsappClient.enviarMensaje).not.toHaveBeenCalled();
  });

  it('devuelve 404 si el recordatorio no existe', async () => {
    recordatorioModel.buscarPorId.mockResolvedValue(null);

    await expect(recordatorioService.reintentar(99)).rejects.toMatchObject({ statusCode: 404 });
  });
});
