const pacienteService = require('../services/paciente.service');

/** GET /api/pacientes */
async function buscar(req, res, next) {
  try {
    const { termino, pagina, porPagina } = req.query;
    const incluirInactivos = req.query.incluirInactivos === 'true';

    res.status(200).json(
      await pacienteService.buscar({ termino, incluirInactivos, pagina, porPagina }),
    );
  } catch (error) {
    next(error);
  }
}

/** GET /api/pacientes/:id */
async function obtener(req, res, next) {
  try {
    res.status(200).json(await pacienteService.obtener(req.params.id));
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/pacientes/telefono/:telefono
 * Base del flujo de recepción: se escribe el número y salen los pacientes que
 * lo tienen. Pueden ser varios, porque los familiares comparten teléfono.
 */
async function porTelefono(req, res, next) {
  try {
    res.status(200).json(await pacienteService.buscarPorTelefono(req.params.telefono));
  } catch (error) {
    next(error);
  }
}

/** POST /api/pacientes */
async function crear(req, res, next) {
  try {
    const resultado = await pacienteService.crear(req.body);
    res.status(201).json(resultado);
  } catch (error) {
    next(error);
  }
}

/** PATCH /api/pacientes/:id */
async function actualizar(req, res, next) {
  try {
    res.status(200).json(await pacienteService.actualizar(req.params.id, req.body));
  } catch (error) {
    next(error);
  }
}

/** DELETE /api/pacientes/:id — baja lógica. */
async function desactivar(req, res, next) {
  try {
    res.status(200).json(await pacienteService.desactivar(req.params.id));
  } catch (error) {
    next(error);
  }
}

/** DELETE /api/pacientes/:id/definitivo — se lleva también su historial. */
async function eliminar(req, res, next) {
  try {
    const resultado = await pacienteService.eliminar(req.params.id, {
      idUsuarioSolicitante: req.usuario.id,
      contrasena: req.body.contrasena,
    });
    res.status(200).json(resultado);
  } catch (error) {
    next(error);
  }
}

/** POST /api/pacientes/:id/reactivar */
async function reactivar(req, res, next) {
  try {
    res.status(200).json(await pacienteService.reactivar(req.params.id));
  } catch (error) {
    next(error);
  }
}

module.exports = {
  buscar,
  obtener,
  porTelefono,
  crear,
  actualizar,
  desactivar,
  eliminar,
  reactivar,
};
