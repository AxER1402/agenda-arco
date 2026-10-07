const examenService = require('../services/examen.service');

/** GET /api/examenes */
async function listar(req, res, next) {
  try {
    const incluirInactivos = req.query.incluirInactivos === 'true';
    res.status(200).json(await examenService.listar({ termino: req.query.termino, incluirInactivos }));
  } catch (error) {
    next(error);
  }
}

/** GET /api/examenes/:id */
async function obtener(req, res, next) {
  try {
    res.status(200).json(await examenService.obtener(req.params.id));
  } catch (error) {
    next(error);
  }
}

/** POST /api/examenes */
async function crear(req, res, next) {
  try {
    res.status(201).json(await examenService.crear(req.body));
  } catch (error) {
    next(error);
  }
}

/** PATCH /api/examenes/:id */
async function actualizar(req, res, next) {
  try {
    res.status(200).json(await examenService.actualizar(req.params.id, req.body));
  } catch (error) {
    next(error);
  }
}

/** DELETE /api/examenes/:id — borrado definitivo de un examen sin usar. */
async function eliminar(req, res, next) {
  try {
    await examenService.eliminar(req.params.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

module.exports = { listar, obtener, crear, actualizar, eliminar };
