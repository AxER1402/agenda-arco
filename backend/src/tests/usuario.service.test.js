jest.mock('../models/usuario.model');
jest.mock('../services/auth.service');

const usuarioModel = require('../models/usuario.model');
const authService = require('../services/auth.service');
const usuarioService = require('../services/usuario.service');
const { ROLES } = require('../utils/roles');

const administrador = {
  id: 1,
  nombre_completo: 'Administrador',
  usuario: 'admin',
  rol: ROLES.ADMINISTRADOR,
  activo: 1,
};

describe('usuario.service.actualizar', () => {
  it('impide dejar al sistema sin administradores activos', async () => {
    usuarioModel.buscarPorId.mockResolvedValue(administrador);
    usuarioModel.contarAdministradoresActivos.mockResolvedValue(1);

    await expect(usuarioService.actualizar(1, { activo: false })).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(usuarioModel.actualizar).not.toHaveBeenCalled();
  });

  it('permite desactivar a un administrador si queda otro activo', async () => {
    usuarioModel.buscarPorId.mockResolvedValue(administrador);
    usuarioModel.contarAdministradoresActivos.mockResolvedValue(2);
    usuarioModel.actualizar.mockResolvedValue({ ...administrador, activo: 0 });

    await usuarioService.actualizar(1, { activo: false });

    expect(usuarioModel.actualizar).toHaveBeenCalled();
  });

  it('impide cambiarle el rol al único administrador', async () => {
    usuarioModel.buscarPorId.mockResolvedValue(administrador);
    usuarioModel.buscarRolPorCodigo.mockResolvedValue({ id: 2, codigo: ROLES.PERSONAL_CITAS });
    usuarioModel.contarAdministradoresActivos.mockResolvedValue(1);

    await expect(
      usuarioService.actualizar(1, { rol: ROLES.PERSONAL_CITAS }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('devuelve 404 si el usuario no existe', async () => {
    usuarioModel.buscarPorId.mockResolvedValue(null);

    await expect(usuarioService.actualizar(99, { activo: false })).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe('usuario.service.desactivar', () => {
  it('no permite que un usuario se desactive a sí mismo', async () => {
    await expect(usuarioService.desactivar(1, 1)).rejects.toMatchObject({ statusCode: 400 });
    expect(usuarioModel.actualizar).not.toHaveBeenCalled();
  });

  it('desactiva a otro usuario', async () => {
    const personal = { ...administrador, id: 5, rol: ROLES.PERSONAL_CITAS };
    usuarioModel.buscarPorId.mockResolvedValue(personal);
    usuarioModel.actualizar.mockResolvedValue({ ...personal, activo: 0 });

    await usuarioService.desactivar(5, 1);

    expect(usuarioModel.actualizar).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ activo: false }),
    );
  });
});

describe('usuario.service.crear', () => {
  it('rechaza un rol inexistente', async () => {
    usuarioModel.existeUsuario.mockResolvedValue(false);
    usuarioModel.buscarRolPorCodigo.mockResolvedValue(null);

    await expect(
      usuarioService.crear({
        nombreCompleto: 'Nuevo',
        usuario: 'nuevo.usuario',
        contrasena: 'ClaveSegura2026',
        rol: 'ROL_QUE_NO_EXISTE',
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('crea el usuario con la contraseña cifrada y el rol resuelto', async () => {
    usuarioModel.existeUsuario.mockResolvedValue(false);
    usuarioModel.buscarRolPorCodigo.mockResolvedValue({ id: 2, codigo: ROLES.PERSONAL_CITAS });
    usuarioModel.crear.mockImplementation(async (datos) => ({ id: 8, ...datos }));

    const creado = await usuarioService.crear({
      nombreCompleto: 'Ana López',
      usuario: 'ana.lopez',
      contrasena: 'ClaveSegura2026',
      rol: ROLES.PERSONAL_CITAS,
    });

    const datos = usuarioModel.crear.mock.calls[0][0];
    expect(creado.id).toBe(8);
    expect(datos).toMatchObject({ nombreCompleto: 'Ana López', usuario: 'ana.lopez', rolId: 2 });
    // Se guarda el hash, nunca la contraseña tal como se escribió.
    expect(datos.passwordHash).not.toBe('ClaveSegura2026');
    expect(datos.passwordHash).toMatch(/^\$2[aby]\$/);
  });

  it('rechaza un nombre de acceso que ya existe', async () => {
    usuarioModel.existeUsuario.mockResolvedValue(true);

    await expect(
      usuarioService.crear({
        nombreCompleto: 'Otra Ana',
        usuario: 'ana.lopez',
        contrasena: 'ClaveSegura2026',
        rol: ROLES.PERSONAL_CITAS,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(usuarioModel.crear).not.toHaveBeenCalled();
  });
});

describe('usuario.service.eliminar', () => {
  const personal = { ...administrador, id: 5, rol: ROLES.PERSONAL_CITAS };

  beforeEach(() => {
    authService.confirmarIdentidad.mockResolvedValue(true);
  });

  it('no permite que un usuario se elimine a sí mismo', async () => {
    await expect(
      usuarioService.eliminar(1, { idUsuarioSolicitante: 1, contrasena: 'x' }),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(usuarioModel.eliminar).not.toHaveBeenCalled();
  });

  it('exige la contraseña de quien lo pide', async () => {
    usuarioModel.buscarPorId.mockResolvedValue(personal);
    authService.confirmarIdentidad.mockRejectedValue(
      Object.assign(new Error('La contraseña no es correcta.'), { statusCode: 401 }),
    );

    await expect(
      usuarioService.eliminar(5, { idUsuarioSolicitante: 1, contrasena: 'mala' }),
    ).rejects.toMatchObject({ statusCode: 401 });

    expect(usuarioModel.eliminar).not.toHaveBeenCalled();
  });

  it('impide borrar al único administrador activo', async () => {
    usuarioModel.buscarPorId.mockResolvedValue(administrador);
    usuarioModel.contarAdministradoresActivos.mockResolvedValue(1);

    await expect(
      usuarioService.eliminar(1, { idUsuarioSolicitante: 2, contrasena: 'buena' }),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(usuarioModel.eliminar).not.toHaveBeenCalled();
  });

  it('borra la fila cuando todo cuadra', async () => {
    usuarioModel.buscarPorId.mockResolvedValue(personal);

    await expect(
      usuarioService.eliminar(5, { idUsuarioSolicitante: 1, contrasena: 'buena' }),
    ).resolves.toEqual({ id: 5, eliminado: true });

    expect(usuarioModel.eliminar).toHaveBeenCalledWith(5);
  });

  it('devuelve 404 si el usuario no existe', async () => {
    usuarioModel.buscarPorId.mockResolvedValue(null);

    await expect(
      usuarioService.eliminar(99, { idUsuarioSolicitante: 1, contrasena: 'buena' }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
