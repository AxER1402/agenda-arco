const ordenService = require('../services/orden.service');
const disponibilidadService = require('../services/disponibilidad.service');

/** GET /api/ordenes?pacienteId= */
async function listar(req, res, next) {
  try {
    if (req.query.pacienteId) {
      return res.status(200).json(await ordenService.listarPorPaciente(req.query.pacienteId));
    }

    return res.status(200).json(await ordenService.listarPorVencer({ dias: req.query.dias }));
  } catch (error) {
    return next(error);
  }
}

/** GET /api/ordenes/por-vencer */
async function listarPorVencer(req, res, next) {
  try {
    res.status(200).json(await ordenService.listarPorVencer({ dias: req.query.dias }));
  } catch (error) {
    next(error);
  }
}

/** GET /api/ordenes/:id */
async function obtener(req, res, next) {
  try {
    res.status(200).json(await ordenService.obtener(req.params.id));
  } catch (error) {
    next(error);
  }
}

/** POST /api/ordenes */
async function crear(req, res, next) {
  try {
    res.status(201).json(await ordenService.crear(req.body, req.usuario.id));
  } catch (error) {
    next(error);
  }
}

/** PATCH /api/ordenes/:id */
async function actualizar(req, res, next) {
  try {
    res.status(200).json(await ordenService.actualizar(req.params.id, req.body));
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/ordenes/vencimiento?fechaEntrega=YYYY-MM-DD
 *
 * Permite al frontend mostrar la fecha de vencimiento mientras se escribe, sin
 * duplicar el cálculo: lo sigue haciendo el backend. Devuelve además las fechas
 * con cupo más cercanas al vencimiento, que es lo que se propone al agendar.
 */
async function calcularVencimiento(req, res, next) {
  try {
    const meses = await ordenService.mesesDeVigencia();
    const fechaVencimiento = ordenService.calcularVencimiento(req.query.fechaEntrega, meses);

    const fechasSugeridas = await disponibilidadService.sugerirFechasParaOrden({
      fecha_vencimiento: fechaVencimiento,
    });

    res.status(200).json({
      fecha_entrega: req.query.fechaEntrega,
      fecha_vencimiento: fechaVencimiento,
      meses_vigencia: meses,
      vencida: ordenService.diasParaVencer(fechaVencimiento) < 0,
      fechas_sugeridas: fechasSugeridas,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { listar, listarPorVencer, obtener, crear, actualizar, calcularVencimiento };
