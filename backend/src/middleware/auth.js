const jwt = require('../utils/jwt');
const AppError = require('../utils/AppError');

/**
 * Autenticación: exige un JWT válido en la cabecera Authorization.
 * Deja en req.usuario los datos mínimos del token.
 */
function autenticar(req, res, next) {
  const cabecera = req.get('authorization') ?? '';
  const [esquema, token] = cabecera.split(' ');

  if (esquema !== 'Bearer' || !token) {
    return next(AppError.unauthorized('Debe iniciar sesión para continuar.'));
  }

  try {
    const payload = jwt.verificar(token);
    req.usuario = { id: payload.sub, usuario: payload.usuario, rol: payload.rol };
    return next();
  } catch (error) {
    const vencido = error.name === 'TokenExpiredError';
    return next(
      AppError.unauthorized(vencido ? 'Su sesión expiró. Inicie sesión nuevamente.' : 'Sesión inválida.'),
    );
  }
}

/**
 * Autorización por rol.
 * Uso: router.post('/', autenticar, autorizar(ROLES.ADMINISTRADOR), handler)
 */
function autorizar(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario) {
      return next(AppError.unauthorized('Debe iniciar sesión para continuar.'));
    }

    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return next(AppError.forbidden('No tiene permisos para realizar esta acción.'));
    }

    return next();
  };
}

module.exports = { autenticar, autorizar };
