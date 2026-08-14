const { autenticar, autorizar } = require('../middleware/auth');
const jwt = require('../utils/jwt');
const { ROLES } = require('../utils/roles');

function peticionFalsa(cabeceras = {}) {
  return {
    get: (nombre) => cabeceras[nombre.toLowerCase()],
  };
}

describe('middleware autenticar', () => {
  it('acepta un token válido y expone el usuario en la petición', () => {
    const token = jwt.firmar({ id: 7, usuario: 'admin', rol: ROLES.ADMINISTRADOR });
    const req = peticionFalsa({ authorization: `Bearer ${token}` });
    const next = jest.fn();

    autenticar(req, {}, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.usuario).toEqual({ id: 7, usuario: 'admin', rol: ROLES.ADMINISTRADOR });
  });

  it.each([
    ['sin cabecera', {}],
    ['con esquema incorrecto', { authorization: 'Basic abc' }],
    ['con token corrupto', { authorization: 'Bearer no-es-un-token' }],
  ])('responde 401 %s', (_caso, cabeceras) => {
    const next = jest.fn();

    autenticar(peticionFalsa(cabeceras), {}, next);

    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 401 });
  });
});

describe('middleware autorizar', () => {
  it('deja pasar al rol permitido', () => {
    const next = jest.fn();

    autorizar(ROLES.ADMINISTRADOR)({ usuario: { rol: ROLES.ADMINISTRADOR } }, {}, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('responde 403 a un rol no permitido', () => {
    const next = jest.fn();

    autorizar(ROLES.ADMINISTRADOR)({ usuario: { rol: ROLES.PERSONAL_CITAS } }, {}, next);

    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 403 });
  });

  it('responde 401 si no hay usuario autenticado', () => {
    const next = jest.fn();

    autorizar(ROLES.ADMINISTRADOR)({}, {}, next);

    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 401 });
  });
});
