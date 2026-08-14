/**
 * Pruebas de la lógica de autenticación.
 * El modelo se simula: no se necesita una base de datos y los casos quedan
 * independientes entre sí.
 */
jest.mock('../models/usuario.model');

const usuarioModel = require('../models/usuario.model');
const authService = require('../services/auth.service');
const password = require('../utils/password');
const jwt = require('../utils/jwt');

const CONTRASENA = 'Laboratorio2026';

async function usuarioDePrueba(cambios = {}) {
  return {
    id: 1,
    nombre_completo: 'Ana López',
    usuario: 'ana.lopez',
    password_hash: await password.hashear(CONTRASENA),
    rol: 'PERSONAL_CITAS',
    rol_id: 2,
    activo: 1,
    ...cambios,
  };
}

describe('auth.service.login', () => {
  it('devuelve un token válido con credenciales correctas', async () => {
    usuarioModel.buscarPorUsuarioConPassword.mockResolvedValue(await usuarioDePrueba());

    const resultado = await authService.login({
      usuario: 'ana.lopez',
      contrasena: CONTRASENA,
    });

    const payload = jwt.verificar(resultado.token);
    expect(payload).toMatchObject({ sub: 1, usuario: 'ana.lopez', rol: 'PERSONAL_CITAS' });
  });

  it('nunca devuelve el hash de la contraseña', async () => {
    usuarioModel.buscarPorUsuarioConPassword.mockResolvedValue(await usuarioDePrueba());

    const resultado = await authService.login({
      usuario: 'ana.lopez',
      contrasena: CONTRASENA,
    });

    expect(resultado.usuario).not.toHaveProperty('password_hash');
  });

  it('registra el último acceso', async () => {
    usuarioModel.buscarPorUsuarioConPassword.mockResolvedValue(await usuarioDePrueba());

    await authService.login({ usuario: 'ana.lopez', contrasena: CONTRASENA });

    expect(usuarioModel.registrarAcceso).toHaveBeenCalledWith(1);
  });

  it('rechaza una contraseña incorrecta', async () => {
    usuarioModel.buscarPorUsuarioConPassword.mockResolvedValue(await usuarioDePrueba());

    await expect(
      authService.login({ usuario: 'ana.lopez', contrasena: 'incorrecta' }),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it('rechaza a un usuario inactivo aunque la contraseña sea correcta', async () => {
    usuarioModel.buscarPorUsuarioConPassword.mockResolvedValue(await usuarioDePrueba({ activo: 0 }));

    await expect(
      authService.login({ usuario: 'ana.lopez', contrasena: CONTRASENA }),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it('usa el mismo mensaje para usuario inexistente y contraseña incorrecta', async () => {
    usuarioModel.buscarPorUsuarioConPassword.mockResolvedValue(null);
    const inexistente = await authService.login({ usuario: 'nadie', contrasena: 'x' }).catch((e) => e);

    usuarioModel.buscarPorUsuarioConPassword.mockResolvedValue(await usuarioDePrueba());
    const incorrecta = await authService
      .login({ usuario: 'ana.lopez', contrasena: 'mala' })
      .catch((e) => e);

    // Mensajes distintos permitirían averiguar qué usuarios existen.
    expect(inexistente.message).toBe(incorrecta.message);
  });

  it('no registra acceso si las credenciales fallan', async () => {
    usuarioModel.buscarPorUsuarioConPassword.mockResolvedValue(null);

    await authService.login({ usuario: 'nadie', contrasena: 'x' }).catch(() => {});

    expect(usuarioModel.registrarAcceso).not.toHaveBeenCalled();
  });
});

describe('auth.service.cambiarContrasenaPropia', () => {
  it('actualiza el hash cuando la contraseña actual es correcta', async () => {
    const usuario = await usuarioDePrueba();
    usuarioModel.buscarPorId.mockResolvedValue(usuario);
    usuarioModel.buscarPorUsuarioConPassword.mockResolvedValue(usuario);

    await authService.cambiarContrasenaPropia(1, {
      contrasenaActual: CONTRASENA,
      contrasenaNueva: 'NuevaClave2026',
    });

    const [id, cambios] = usuarioModel.actualizar.mock.calls[0];
    expect(id).toBe(1);
    // Se guarda un hash, nunca la contraseña en texto plano.
    expect(cambios.passwordHash).not.toBe('NuevaClave2026');
    await expect(password.verificar('NuevaClave2026', cambios.passwordHash)).resolves.toBe(true);
  });

  it('rechaza el cambio si la contraseña actual no coincide', async () => {
    const usuario = await usuarioDePrueba();
    usuarioModel.buscarPorId.mockResolvedValue(usuario);
    usuarioModel.buscarPorUsuarioConPassword.mockResolvedValue(usuario);

    await expect(
      authService.cambiarContrasenaPropia(1, {
        contrasenaActual: 'equivocada',
        contrasenaNueva: 'NuevaClave2026',
      }),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(usuarioModel.actualizar).not.toHaveBeenCalled();
  });
});
