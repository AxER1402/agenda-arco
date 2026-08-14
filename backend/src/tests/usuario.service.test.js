jest.mock('../models/usuario.model');

const usuarioModel = require('../models/usuario.model');
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
});
