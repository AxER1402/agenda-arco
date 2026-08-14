/**
 * Pruebas HTTP de /api/auth y /api/usuarios con Supertest.
 * El modelo se simula para no depender de MySQL.
 */
jest.mock('../models/usuario.model');

const request = require('supertest');
const usuarioModel = require('../models/usuario.model');
const createApp = require('../app');
const password = require('../utils/password');
const jwt = require('../utils/jwt');
const { ROLES } = require('../utils/roles');

const CONTRASENA = 'Laboratorio2026';
const app = createApp();

function tokenDe(rol, id = 1) {
  return jwt.firmar({ id, usuario: 'usuario.prueba', rol });
}

async function filaUsuario(cambios = {}) {
  return {
    id: 1,
    nombre_completo: 'Ana López',
    usuario: 'ana.lopez',
    password_hash: await password.hashear(CONTRASENA),
    rol: ROLES.PERSONAL_CITAS,
    rol_id: 2,
    activo: 1,
    ...cambios,
  };
}

describe('POST /api/auth/login', () => {
  it('devuelve 200 y un token con credenciales correctas', async () => {
    usuarioModel.buscarPorUsuarioConPassword.mockResolvedValue(await filaUsuario());

    const respuesta = await request(app)
      .post('/api/auth/login')
      .send({ usuario: 'ana.lopez', contrasena: CONTRASENA });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.token).toEqual(expect.any(String));
    expect(respuesta.body.usuario.password_hash).toBeUndefined();
  });

  it('devuelve 401 con credenciales incorrectas', async () => {
    usuarioModel.buscarPorUsuarioConPassword.mockResolvedValue(await filaUsuario());

    const respuesta = await request(app)
      .post('/api/auth/login')
      .send({ usuario: 'ana.lopez', contrasena: 'incorrecta' });

    expect(respuesta.status).toBe(401);
  });

  it('devuelve 422 y el detalle por campo si faltan datos', async () => {
    const respuesta = await request(app).post('/api/auth/login').send({ usuario: '' });

    expect(respuesta.status).toBe(422);
    expect(respuesta.body.error.detalles).toEqual(
      expect.arrayContaining([expect.objectContaining({ campo: 'usuario' })]),
    );
  });
});

describe('GET /api/auth/perfil', () => {
  it('devuelve los datos del usuario autenticado', async () => {
    usuarioModel.buscarPorId.mockResolvedValue(await filaUsuario());

    const respuesta = await request(app)
      .get('/api/auth/perfil')
      .set('Authorization', `Bearer ${tokenDe(ROLES.PERSONAL_CITAS)}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.usuario).toBe('ana.lopez');
  });

  it('devuelve 401 sin token', async () => {
    const respuesta = await request(app).get('/api/auth/perfil');

    expect(respuesta.status).toBe(401);
  });
});

describe('protección de /api/usuarios', () => {
  it('devuelve 401 sin token', async () => {
    const respuesta = await request(app).get('/api/usuarios');

    expect(respuesta.status).toBe(401);
  });

  it('devuelve 403 al personal de citas', async () => {
    const respuesta = await request(app)
      .get('/api/usuarios')
      .set('Authorization', `Bearer ${tokenDe(ROLES.PERSONAL_CITAS)}`);

    expect(respuesta.status).toBe(403);
    expect(usuarioModel.listar).not.toHaveBeenCalled();
  });

  it('devuelve 200 al administrador', async () => {
    usuarioModel.listar.mockResolvedValue([await filaUsuario()]);

    const respuesta = await request(app)
      .get('/api/usuarios')
      .set('Authorization', `Bearer ${tokenDe(ROLES.ADMINISTRADOR)}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toHaveLength(1);
  });

  it('devuelve 201 al crear un usuario válido', async () => {
    usuarioModel.existeUsuario.mockResolvedValue(false);
    usuarioModel.buscarRolPorCodigo.mockResolvedValue({ id: 2, codigo: ROLES.PERSONAL_CITAS });
    usuarioModel.crear.mockResolvedValue(await filaUsuario());

    const respuesta = await request(app)
      .post('/api/usuarios')
      .set('Authorization', `Bearer ${tokenDe(ROLES.ADMINISTRADOR)}`)
      .send({
        nombreCompleto: 'Carlos Ruiz',
        usuario: 'carlos.ruiz',
        contrasena: 'ClaveSegura2026',
        rol: ROLES.PERSONAL_CITAS,
      });

    expect(respuesta.status).toBe(201);
    // La contraseña se guarda hasheada, nunca en texto plano.
    expect(usuarioModel.crear.mock.calls[0][0].passwordHash).not.toBe('ClaveSegura2026');
  });

  it('devuelve 409 si el nombre de acceso ya existe', async () => {
    usuarioModel.existeUsuario.mockResolvedValue(true);

    const respuesta = await request(app)
      .post('/api/usuarios')
      .set('Authorization', `Bearer ${tokenDe(ROLES.ADMINISTRADOR)}`)
      .send({
        nombreCompleto: 'Carlos Ruiz',
        usuario: 'ana.lopez',
        contrasena: 'ClaveSegura2026',
        rol: ROLES.PERSONAL_CITAS,
      });

    expect(respuesta.status).toBe(409);
  });

  it('devuelve 422 con una contraseña demasiado corta', async () => {
    const respuesta = await request(app)
      .post('/api/usuarios')
      .set('Authorization', `Bearer ${tokenDe(ROLES.ADMINISTRADOR)}`)
      .send({
        nombreCompleto: 'Carlos Ruiz',
        usuario: 'carlos.ruiz',
        contrasena: '123',
        rol: ROLES.PERSONAL_CITAS,
      });

    expect(respuesta.status).toBe(422);
  });
});
