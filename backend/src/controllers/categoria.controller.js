const categoriaService = require('../services/categoria.service');

/** GET /api/categorias-examen */
async function listar(req, res, next) {
  try {
    res.status(200).json(await categoriaService.listar());
  } catch (error) {
    next(error);
  }
}

/** POST /api/categorias-examen */
async function crear(req, res, next) {
  try {
    res.status(201).json(await categoriaService.crear(req.body));
  } catch (error) {
    next(error);
  }
}

/** PATCH /api/categorias-examen/:id */
async function actualizar(req, res, next) {
  try {
    res.status(200).json(await categoriaService.actualizar(req.params.id, req.body));
  } catch (error) {
    next(error);
  }
}

/** DELETE /api/categorias-examen/:id */
async function eliminar(req, res, next) {
  try {
    await categoriaService.eliminar(req.params.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

module.exports = { listar, crear, actualizar, eliminar };
