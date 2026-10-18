/**
 * Pruebas de la lógica de autenticación.
 * El modelo se simula: no se necesita una base de datos y los casos quedan
 * independientes entre sí.
 */
jest.mock('../models/usuario.model');
// Nunca se habla con Google: la verificación de la credencial se simula.
jest.mock('../utils/google');

const env = require('../config/env');
const usuarioModel = require('../models/usuario.model');
const authService = require('../services/auth.service');
const google = require('../utils/google');
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

describe('auth.service.loginConGoogle', () => {
  const identidad = { correo: 'ana.lopez@gmail.com', correoVerificado: true, nombre: 'Ana López' };

  it('entra con el usuario que tiene ese correo y devuelve un token válido', async () => {
    google.verificarCredencial.mockResolvedValue(identidad);
    usuarioModel.buscarPorCorreo.mockResolvedValue(
      await usuarioDePrueba({ correo: 'ana.lopez@gmail.com' }),
    );

    const resultado = await authService.loginConGoogle({ credencial: 'credencial-de-google' });

    expect(google.verificarCredencial).toHaveBeenCalledWith('credencial-de-google');
    expect(usuarioModel.buscarPorCorreo).toHaveBeenCalledWith('ana.lopez@gmail.com');
    expect(jwt.verificar(resultado.token)).toMatchObject({ sub: 1, rol: 'PERSONAL_CITAS' });
    expect(resultado.usuario).not.toHaveProperty('password_hash');
    expect(usuarioModel.registrarAcceso).toHaveBeenCalledWith(1);
  });

  /**
   * Google dice quién es la persona, pero quién entra lo decide el
   * administrador: una cuenta de Google cualquiera no abre el sistema.
   */
  it('guarda la foto de Google y la devuelve con el usuario', async () => {
    google.verificarCredencial.mockResolvedValue({
      ...identidad,
      foto: 'https://lh3.googleusercontent.com/a/foto-nueva=s96-c',
    });
    usuarioModel.buscarPorCorreo.mockResolvedValue(await usuarioDePrueba({ foto_url: null }));

    const resultado = await authService.loginConGoogle({ credencial: 'credencial-de-google' });

    expect(usuarioModel.actualizar).toHaveBeenCalledWith(1, {
      fotoUrl: 'https://lh3.googleusercontent.com/a/foto-nueva=s96-c',
    });
    expect(resultado.usuario.foto_url).toBe('https://lh3.googleusercontent.com/a/foto-nueva=s96-c');
  });

  it('no escribe en la base si la foto no cambió', async () => {
    const foto = 'https://lh3.googleusercontent.com/a/la-misma=s96-c';
    google.verificarCredencial.mockResolvedValue({ ...identidad, foto });
    usuarioModel.buscarPorCorreo.mockResolvedValue(await usuarioDePrueba({ foto_url: foto }));

    await authService.loginConGoogle({ credencial: 'credencial-de-google' });

    expect(usuarioModel.actualizar).not.toHaveBeenCalled();
  });

  it('rechaza un correo que no está vinculado a ningún usuario', async () => {
    google.verificarCredencial.mockResolvedValue(identidad);
    usuarioModel.buscarPorCorreo.mockResolvedValue(null);

    await expect(
      authService.loginConGoogle({ credencial: 'credencial-de-google' }),
    ).rejects.toMatchObject({ statusCode: 401 });
    expect(usuarioModel.registrarAcceso).not.toHaveBeenCalled();
  });

  it('rechaza a un usuario inactivo', async () => {
    google.verificarCredencial.mockResolvedValue(identidad);
    usuarioModel.buscarPorCorreo.mockResolvedValue(await usuarioDePrueba({ activo: 0 }));

    await expect(
      authService.loginConGoogle({ credencial: 'credencial-de-google' }),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it('rechaza una cuenta de Google con el correo sin verificar', async () => {
    google.verificarCredencial.mockResolvedValue({ ...identidad, correoVerificado: false });
    usuarioModel.buscarPorCorreo.mockResolvedValue(await usuarioDePrueba());

    await expect(
      authService.loginConGoogle({ credencial: 'credencial-de-google' }),
    ).rejects.toMatchObject({ statusCode: 401 });
    expect(usuarioModel.buscarPorCorreo).not.toHaveBeenCalled();
  });

  it('rechaza una credencial que Google no da por buena', async () => {
    google.verificarCredencial.mockRejectedValue(new Error('Wrong recipient'));

    const error = await authService
      .loginConGoogle({ credencial: 'credencial-falsa' })
      .catch((e) => e);

    expect(error.statusCode).toBe(401);
    // El motivo técnico de la librería no llega a la pantalla.
    expect(error.message).not.toMatch(/recipient/i);
  });

  it('responde 404 si el acceso con Google no está configurado', async () => {
    const original = env.google.clientId;
    env.google.clientId = '';

    try {
      await expect(
        authService.loginConGoogle({ credencial: 'credencial-de-google' }),
      ).rejects.toMatchObject({ statusCode: 404 });
      expect(google.verificarCredencial).not.toHaveBeenCalled();
    } finally {
      env.google.clientId = original;
    }
  });
});

describe('auth.service.configuracionGoogle', () => {
  it('indica el cliente cuando está configurado', () => {
    expect(authService.configuracionGoogle()).toEqual({
      habilitado: true,
      clientId: 'cliente-de-prueba.apps.googleusercontent.com',
    });
  });

  it('lo da por deshabilitado sin identificador de cliente', () => {
    const original = env.google.clientId;
    env.google.clientId = '';

    try {
      expect(authService.configuracionGoogle()).toEqual({ habilitado: false, clientId: null });
    } finally {
      env.google.clientId = original;
    }
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
