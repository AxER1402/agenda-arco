/**
 * Pruebas HTTP de los recursos de negocio: protección, códigos de estado y
 * validación de entradas.
 */
jest.mock('../models/paciente.model');
jest.mock('../models/cita.model');
jest.mock('../models/orden.model');
jest.mock('../models/examen.model');
jest.mock('../models/configuracion.model');
jest.mock('../models/recordatorio.model');
jest.mock('../models/usuario.model');
jest.mock('../utils/password');
jest.mock('../services/whatsapp.client');

const request = require('supertest');

const pacienteModel = require('../models/paciente.model');
const citaModel = require('../models/cita.model');
const ordenModel = require('../models/orden.model');
const examenModel = require('../models/examen.model');
const configuracionModel = require('../models/configuracion.model');
const usuarioModel = require('../models/usuario.model');
const password = require('../utils/password');

const createApp = require('../app');
const jwt = require('../utils/jwt');
const fechas = require('../utils/fechas');
const { ROLES } = require('../utils/roles');

const app = createApp();
const HOY = fechas.hoy();
const MANANA = fechas.sumarDias(HOY, 1);

const tokenAdmin = jwt.firmar({ id: 1, usuario: 'admin', rol: ROLES.ADMINISTRADOR });
const tokenCitas = jwt.firmar({ id: 2, usuario: 'citas', rol: ROLES.PERSONAL_CITAS });

beforeEach(() => {
  configuracionModel.obtener.mockImplementation(async (clave) => {
    const valores = {
      limite_diario_pacientes: '40',
      vigencia_orden_meses: '3',
      dias_laborables: '1,2,3,4,5,6,7',
      hora_apertura: '07:00',
      hora_cierre: '17:00',
      intervalo_citas_minutos: '15',
      nombre_laboratorio: 'El Arco Laboratorios',
    };
    return valores[clave] ? { clave, valor: valores[clave] } : null;
  });

  // Sesión válida y contraseña correcta por defecto: lo que cada prueba de
  // borrado quiera romper, lo rompe ella.
  usuarioModel.buscarPorId.mockResolvedValue({ id: 2, usuario: 'citas', activo: 1 });
  usuarioModel.buscarPorUsuarioConPassword.mockResolvedValue({
    id: 2,
    usuario: 'citas',
    password_hash: 'hash-de-prueba',
  });
  password.verificar.mockResolvedValue(true);

  pacienteModel.buscar.mockResolvedValue({ pacientes: [], total: 0 });
  pacienteModel.buscarPorTelefono.mockResolvedValue([]);
  pacienteModel.buscarPorId.mockResolvedValue({ id: 1, nombre_completo: 'Ana', activo: 1 });
  pacienteModel.crear.mockImplementation(async (datos) => ({ id: 1, ...datos }));

  citaModel.listarPorRango.mockResolvedValue([]);
  citaModel.contarOcupacionPorRango.mockResolvedValue(new Map());
  citaModel.contarOcupacion.mockResolvedValue(0);
  citaModel.listarEstados.mockResolvedValue([{ id: 1, codigo: 'PENDIENTE' }]);

  ordenModel.listarPorVencer.mockResolvedValue([]);
  examenModel.listar.mockResolvedValue([]);
});

describe('protección de los recursos', () => {
  it.each([
    ['GET', '/api/pacientes'],
    ['GET', '/api/examenes'],
    ['GET', '/api/ordenes'],
    ['GET', '/api/citas/estados'],
    ['GET', '/api/agenda'],
    ['GET', '/api/recordatorios'],
    ['GET', '/api/reportes/citas'],
    ['GET', '/api/reportes/actividad'],
  ])('%s %s exige sesión', async (metodo, ruta) => {
    const respuesta = await request(app)[metodo.toLowerCase()](ruta);

    expect(respuesta.status).toBe(401);
  });
});

describe('GET /api/pacientes', () => {
  it('devuelve 200 al personal de citas', async () => {
    const respuesta = await request(app)
      .get('/api/pacientes')
      .set('Authorization', `Bearer ${tokenCitas}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toHaveProperty('paginacion');
  });
});

describe('POST /api/pacientes', () => {
  it('devuelve 201 con datos válidos', async () => {
    const respuesta = await request(app)
      .post('/api/pacientes')
      .set('Authorization', `Bearer ${tokenCitas}`)
      .send({ nombreCompleto: 'Ana López', telefono: '55555555' });

    expect(respuesta.status).toBe(201);
  });

  it.each(['2323232', '232323233'])('devuelve 422 con el teléfono %s', async (telefono) => {
    const respuesta = await request(app)
      .post('/api/pacientes')
      .set('Authorization', `Bearer ${tokenCitas}`)
      .send({ nombreCompleto: 'Ana López', telefono });

    expect(respuesta.status).toBe(422);
    expect(respuesta.body.error.detalles[0].campo).toBe('telefono');
  });
});

describe('DELETE /api/pacientes/:id', () => {
  it('el personal de citas no puede dar de baja pacientes', async () => {
    const respuesta = await request(app)
      .delete('/api/pacientes/1')
      .set('Authorization', `Bearer ${tokenCitas}`);

    expect(respuesta.status).toBe(403);
  });

  it('el administrador sí puede', async () => {
    pacienteModel.actualizar.mockResolvedValue({ id: 1, activo: 0 });

    const respuesta = await request(app)
      .delete('/api/pacientes/1')
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(respuesta.status).toBe(200);
  });
});

describe('GET /api/ordenes/vencimiento', () => {
  it('calcula el vencimiento en el backend', async () => {
    const respuesta = await request(app)
      .get('/api/ordenes/vencimiento?fechaEntrega=2026-08-10')
      .set('Authorization', `Bearer ${tokenCitas}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toMatchObject({
      fecha_vencimiento: '2026-11-10',
      meses_vigencia: 3,
    });
  });

  it('devuelve 422 si la fecha no es válida', async () => {
    const respuesta = await request(app)
      .get('/api/ordenes/vencimiento?fechaEntrega=2026-02-31')
      .set('Authorization', `Bearer ${tokenCitas}`);

    expect(respuesta.status).toBe(422);
  });
});

describe('POST /api/citas', () => {
  it('devuelve 422 con fecha posterior al vencimiento e incluye sugerencias', async () => {
    ordenModel.buscarPorId.mockResolvedValue({
      id: 10,
      paciente_id: 1,
      fecha_vencimiento: fechas.sumarDias(HOY, 10),
      examenes: [{ id: 1, nombre: 'Glucosa' }],
    });

    const respuesta = await request(app)
      .post('/api/citas')
      .set('Authorization', `Bearer ${tokenCitas}`)
      .send({
        pacienteId: 1,
        ordenId: 10,
        fecha: fechas.sumarDias(HOY, 40),
        hora: '09:00',
      });

    expect(respuesta.status).toBe(422);
    expect(respuesta.body.error.detalles.motivo).toBe('FUERA_DE_VIGENCIA');
    expect(respuesta.body.error.detalles.fechas_sugeridas.length).toBeGreaterThan(0);
  });

  it('devuelve 201 con datos válidos', async () => {
    ordenModel.buscarPorId.mockResolvedValue({
      id: 10,
      paciente_id: 1,
      fecha_vencimiento: fechas.sumarDias(HOY, 30),
      examenes: [{ id: 1, nombre: 'Glucosa' }],
    });
    citaModel.existeCitaActiva.mockResolvedValue(false);
    citaModel.buscarEstadoPorCodigo.mockResolvedValue({ id: 1, codigo: 'PENDIENTE' });
    citaModel.crear.mockImplementation(async (datos, verificarCupo) => {
      verificarCupo(0);
      return { id: 100, ...datos };
    });

    const respuesta = await request(app)
      .post('/api/citas')
      .set('Authorization', `Bearer ${tokenCitas}`)
      .send({ pacienteId: 1, ordenId: 10, fecha: MANANA, hora: '09:00' });

    expect(respuesta.status).toBe(201);
  });

  it('devuelve 422 con una hora mal formada', async () => {
    const respuesta = await request(app)
      .post('/api/citas')
      .set('Authorization', `Bearer ${tokenCitas}`)
      .send({ pacienteId: 1, ordenId: 10, fecha: MANANA, hora: '9am' });

    expect(respuesta.status).toBe(422);
  });
});

describe('GET /api/agenda', () => {
  it('acepta las tres vistas', async () => {
    for (const vista of ['dia', 'semana', 'mes']) {
      const respuesta = await request(app)
        .get(`/api/agenda?vista=${vista}&fecha=${HOY}`)
        .set('Authorization', `Bearer ${tokenCitas}`);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.vista).toBe(vista);
    }
  });

  it('rechaza una vista desconocida', async () => {
    const respuesta = await request(app)
      .get('/api/agenda?vista=trimestre')
      .set('Authorization', `Bearer ${tokenCitas}`);

    expect(respuesta.status).toBe(422);
  });
});

describe('PATCH /api/agenda/configuracion', () => {
  it('el personal de citas no puede cambiar el límite diario', async () => {
    const respuesta = await request(app)
      .patch('/api/agenda/configuracion')
      .set('Authorization', `Bearer ${tokenCitas}`)
      .send({ limite_diario_pacientes: 10 });

    expect(respuesta.status).toBe(403);
    expect(configuracionModel.establecer).not.toHaveBeenCalled();
  });

  it('el administrador sí puede', async () => {
    const respuesta = await request(app)
      .patch('/api/agenda/configuracion')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ limite_diario_pacientes: 25 });

    expect(respuesta.status).toBe(200);
    expect(configuracionModel.establecer).toHaveBeenCalledWith(
      'limite_diario_pacientes',
      '25',
      1,
    );
  });

  it('rechaza un límite fuera de rango', async () => {
    const respuesta = await request(app)
      .patch('/api/agenda/configuracion')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ limite_diario_pacientes: 0 });

    expect(respuesta.status).toBe(422);
  });
  it('guarda la hora con la que llega el formulario de nueva cita', async () => {
    const respuesta = await request(app)
      .patch('/api/agenda/configuracion')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ hora_cita_predeterminada: '08:30' });

    expect(respuesta.status).toBe(200);
    expect(configuracionModel.establecer).toHaveBeenCalledWith(
      'hora_cita_predeterminada',
      '08:30',
      1,
    );
  });

  it('guarda los feriados como JSON', async () => {
    const feriados = [{ fecha: '2026-09-15', descripcion: 'Independencia', anual: true }];

    const respuesta = await request(app)
      .patch('/api/agenda/configuracion')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ dias_feriados: feriados });

    expect(respuesta.status).toBe(200);
    expect(configuracionModel.establecer).toHaveBeenCalledWith(
      'dias_feriados',
      JSON.stringify(feriados),
      1,
    );
  });

  it.each([
    ['una fecha que no existe', [{ fecha: '2026-02-31', descripcion: 'X', anual: false }]],
    [
      'el mismo día dos veces',
      [
        { fecha: '2026-12-25', descripcion: 'Navidad', anual: true },
        { fecha: '2027-12-25', descripcion: 'Otra', anual: false },
      ],
    ],
  ])('rechaza feriados con %s', async (_caso, feriados) => {
    const respuesta = await request(app)
      .patch('/api/agenda/configuracion')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ dias_feriados: feriados });

    expect(respuesta.status).toBeGreaterThanOrEqual(400);
    expect(configuracionModel.establecer).not.toHaveBeenCalledWith(
      'dias_feriados',
      expect.anything(),
      expect.anything(),
    );
  });
});

describe('DELETE /api/citas/:id', () => {
  beforeEach(() => {
    citaModel.buscarPorId.mockResolvedValue({
      id: 100,
      paciente_id: 1,
      orden_id: 10,
      fecha: MANANA,
      hora: '09:00:00',
      estado: 'PENDIENTE',
      estado_nombre: 'Pendiente',
    });
    citaModel.eliminar.mockResolvedValue(true);
  });

  it('borra la cita cuando la contraseña es correcta', async () => {
    const respuesta = await request(app)
      .delete('/api/citas/100')
      .set('Authorization', `Bearer ${tokenCitas}`)
      .send({ contrasena: 'Laboratorio2026' });

    expect(respuesta.status).toBe(200);
    expect(citaModel.eliminar).toHaveBeenCalledWith(100);
  });

  it('devuelve 401 y no borra si la contraseña es incorrecta', async () => {
    password.verificar.mockResolvedValue(false);

    const respuesta = await request(app)
      .delete('/api/citas/100')
      .set('Authorization', `Bearer ${tokenCitas}`)
      .send({ contrasena: 'equivocada' });

    expect(respuesta.status).toBe(401);
    expect(citaModel.eliminar).not.toHaveBeenCalled();
  });

  it('devuelve 422 y no borra si no se envía contraseña', async () => {
    const respuesta = await request(app)
      .delete('/api/citas/100')
      .set('Authorization', `Bearer ${tokenCitas}`)
      .send({});

    expect(respuesta.status).toBe(422);
    expect(citaModel.eliminar).not.toHaveBeenCalled();
  });
});

describe('Mensaje del recordatorio', () => {
  const IMAGEN = 'data:image/png;base64,iVBORw0KGgo=';

  it('cualquier sesión puede consultar cómo está redactado', async () => {
    const respuesta = await request(app)
      .get('/api/recordatorios/plantilla')
      .set('Authorization', `Bearer ${tokenCitas}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toHaveProperty('plantilla');
    expect(respuesta.body).toHaveProperty('marcadores.paciente');
  });

  it('el personal de citas no puede reescribirlo', async () => {
    const respuesta = await request(app)
      .put('/api/recordatorios/plantilla')
      .set('Authorization', `Bearer ${tokenCitas}`)
      .send({ plantilla: 'Hola {paciente}' });

    expect(respuesta.status).toBe(403);
    expect(configuracionModel.establecer).not.toHaveBeenCalled();
  });

  it('el administrador guarda texto e imagen', async () => {
    const respuesta = await request(app)
      .put('/api/recordatorios/plantilla')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ plantilla: 'Hola {paciente}', imagen: IMAGEN });

    expect(respuesta.status).toBe(200);
    expect(configuracionModel.establecer).toHaveBeenCalledWith(
      'plantilla_recordatorio',
      'Hola {paciente}',
      1,
    );
    expect(configuracionModel.establecer).toHaveBeenCalledWith('imagen_recordatorio', IMAGEN, 1);
  });

  it('rechaza un marcador que no existe', async () => {
    const respuesta = await request(app)
      .put('/api/recordatorios/plantilla')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ plantilla: 'Hola {apellido}' });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.mensaje).toContain('{apellido}');
  });

  it('la vista previa no guarda nada', async () => {
    const respuesta = await request(app)
      .post('/api/recordatorios/plantilla/previsualizar')
      .set('Authorization', `Bearer ${tokenCitas}`)
      .send({ plantilla: 'Hola {paciente}.' });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.mensaje).toMatch(/^Hola María González\./);
    expect(configuracionModel.establecer).not.toHaveBeenCalled();
  });

  /**
   * La imagen viaja en base64 y no cabe en el límite general de la API: si el
   * parser propio de esta ruta desapareciera, subirla devolvería 413.
   */
  it('admite una imagen mayor que el límite general del resto de la API', async () => {
    const grande = `data:image/png;base64,${'A'.repeat(300_000)}=`;

    const respuesta = await request(app)
      .put('/api/recordatorios/plantilla')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ imagen: grande });

    expect(respuesta.status).toBe(200);
  });
});

/**
 * Desvincular deja al laboratorio sin recordatorios automáticos hasta que
 * alguien vuelva a escanear: es una acción de administrador, como el QR.
 */
describe('Desvincular WhatsApp', () => {
  const whatsappClient = require('../services/whatsapp.client');

  it('el personal de citas no puede desvincular', async () => {
    const respuesta = await request(app)
      .post('/api/recordatorios/whatsapp/desvincular')
      .set('Authorization', `Bearer ${tokenCitas}`);

    expect(respuesta.status).toBe(403);
    expect(whatsappClient.desvincular).not.toHaveBeenCalled();
  });

  it('el administrador desvincula y recibe qué hacer a continuación', async () => {
    whatsappClient.desvincular.mockResolvedValue({ desvinculada: true, estabaVinculada: true });

    const respuesta = await request(app)
      .post('/api/recordatorios/whatsapp/desvincular')
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.desvinculada).toBe(true);
    expect(respuesta.body.mensaje).toMatch(/QR/);
  });

  /** Sin cuenta vinculada no es un error: el resultado buscado ya se cumple. */
  it('responde 200 aunque no hubiera nada vinculado', async () => {
    whatsappClient.desvincular.mockResolvedValue({ desvinculada: false, estabaVinculada: false });

    const respuesta = await request(app)
      .post('/api/recordatorios/whatsapp/desvincular')
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.mensaje).toMatch(/No había ninguna cuenta vinculada/);
  });

  /**
   * Con un Error pelado la respuesta sería «Ocurrió un error interno», que no
   * le dice al administrador si reintentar o ir a mirar el contenedor.
   */
  it('explica el motivo cuando el servicio de WhatsApp no responde', async () => {
    const AppError = require('../utils/AppError');
    whatsappClient.desvincular.mockRejectedValue(
      new AppError('No fue posible contactar con el servicio de WhatsApp.', 503),
    );

    const respuesta = await request(app)
      .post('/api/recordatorios/whatsapp/desvincular')
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(respuesta.status).toBe(503);
    expect(respuesta.body.error.mensaje).toMatch(/servicio de WhatsApp/);
  });
});

describe('Catálogo de exámenes', () => {
  beforeEach(() => {
    examenModel.buscarPorCodigo.mockResolvedValue(null);
    examenModel.crear.mockResolvedValue({ id: 9, codigo: 'X-1', nombre: 'Prueba' });
  });

  // El personal de citas necesita poder darlos de alta: si un paciente llega
  // con un examen que no está en el catálogo, no puede quedarse sin agendar.
  it('el personal de citas puede crear exámenes', async () => {
    const respuesta = await request(app)
      .post('/api/examenes')
      .set('Authorization', `Bearer ${tokenCitas}`)
      .send({ codigo: 'X-1', nombre: 'Prueba' });

    expect(respuesta.status).toBe(201);
  });

  it('el personal de citas puede modificar y desactivar exámenes', async () => {
    examenModel.buscarPorId.mockResolvedValue({ id: 9, codigo: 'X-1', nombre: 'Prueba', activo: 1 });
    examenModel.actualizar.mockResolvedValue({ id: 9, codigo: 'X-1', nombre: 'Otro', activo: 0 });

    const respuesta = await request(app)
      .patch('/api/examenes/9')
      .set('Authorization', `Bearer ${tokenCitas}`)
      .send({ nombre: 'Otro', activo: false });

    expect(respuesta.status).toBe(200);
    expect(examenModel.actualizar).toHaveBeenCalledWith('9', { activo: false, nombre: 'Otro' });
  });

  it('el personal de citas puede eliminar un examen que nadie usa', async () => {
    examenModel.buscarPorId.mockResolvedValue({ id: 9, codigo: 'X-1', nombre: 'Prueba', activo: 1 });
    examenModel.contarUsos.mockResolvedValue({ citas: 0, ordenes: 0 });

    const respuesta = await request(app)
      .delete('/api/examenes/9')
      .set('Authorization', `Bearer ${tokenCitas}`);

    expect(respuesta.status).toBe(204);
    expect(examenModel.eliminar).toHaveBeenCalledWith('9');
  });

  it('no elimina un examen que ya está en citas u órdenes', async () => {
    examenModel.buscarPorId.mockResolvedValue({ id: 9, codigo: 'X-1', nombre: 'Prueba', activo: 1 });
    examenModel.contarUsos.mockResolvedValue({ citas: 3, ordenes: 1 });

    const respuesta = await request(app)
      .delete('/api/examenes/9')
      .set('Authorization', `Bearer ${tokenCitas}`);

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.mensaje).toMatch(/Desactívelo/);
    expect(examenModel.eliminar).not.toHaveBeenCalled();
  });
});

describe('GET /api/reportes', () => {
  const PERIODO = 'desde=2026-09-01&hasta=2026-09-30';

  beforeEach(() => {
    citaModel.listarPorRango.mockResolvedValue([]);
  });

  it('devuelve un PDF, con el nombre del archivo en la cabecera', async () => {
    const respuesta = await request(app)
      .get(`/api/reportes/citas?${PERIODO}`)
      .set('Authorization', `Bearer ${tokenCitas}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.headers['content-type']).toBe('application/pdf');
    expect(respuesta.headers['content-disposition']).toContain(
      'citas-2026-09-01-a-2026-09-30.pdf',
    );
    expect(respuesta.body.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('devuelve un Word cuando se pide formato docx', async () => {
    const respuesta = await request(app)
      .get(`/api/reportes/actividad?${PERIODO}&formato=docx`)
      .set('Authorization', `Bearer ${tokenCitas}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.headers['content-type']).toContain('wordprocessingml.document');
    expect(respuesta.headers['content-disposition']).toContain(
      'actividad-2026-09-01-a-2026-09-30.docx',
    );
  });

  it('rechaza un formato que no existe', async () => {
    const respuesta = await request(app)
      .get(`/api/reportes/citas?${PERIODO}&formato=xls`)
      .set('Authorization', `Bearer ${tokenCitas}`);

    expect(respuesta.status).toBe(422);
  });

  it('rechaza un periodo sin fechas', async () => {
    const respuesta = await request(app)
      .get('/api/reportes/citas')
      .set('Authorization', `Bearer ${tokenCitas}`);

    expect(respuesta.status).toBe(422);
  });
});
