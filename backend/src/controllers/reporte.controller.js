const reporteService = require('../services/reporte.service');
const pdf = require('../reportes/pdf');
const docx = require('../reportes/docx');

const GENERADORES = { pdf, docx };

/**
 * Arma el documento, lo pinta en el formato pedido y lo manda como descarga.
 * El nombre del archivo lo decide el propio reporte, que es quien sabe de qué
 * periodo es.
 */
async function responderConReporte(req, res, construir) {
  const generador = GENERADORES[req.query.formato ?? 'pdf'];
  const documento = await construir();
  const contenido = await generador.renderizar(documento);

  res.setHeader('Content-Type', generador.tipoMime);
  res.setHeader('Content-Length', contenido.length);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${documento.archivo}.${generador.extension}"`,
  );

  res.status(200).send(contenido);
}

/** GET /api/reportes/citas?desde=&hasta=&estado=&formato=pdf|docx */
async function citas(req, res, next) {
  try {
    await responderConReporte(req, res, () =>
      reporteService.listadoDeCitas({
        desde: req.query.desde,
        hasta: req.query.hasta,
        estado: req.query.estado || null,
        usuario: req.usuario,
      }),
    );
  } catch (error) {
    next(error);
  }
}

/** GET /api/reportes/actividad?desde=&hasta=&formato=pdf|docx */
async function actividad(req, res, next) {
  try {
    await responderConReporte(req, res, () =>
      reporteService.resumenDeActividad({
        desde: req.query.desde,
        hasta: req.query.hasta,
        usuario: req.usuario,
      }),
    );
  } catch (error) {
    next(error);
  }
}

module.exports = { citas, actividad };
