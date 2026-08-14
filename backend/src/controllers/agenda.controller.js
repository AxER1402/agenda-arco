const agendaService = require('../services/agenda.service');
const configuracionService = require('../services/configuracion.service');
const recordatoriosJob = require('../jobs/recordatorios.job');

/** GET /api/agenda?vista=dia|semana|mes&fecha=YYYY-MM-DD */
async function obtenerVista(req, res, next) {
  try {
    const { vista = 'dia', fecha } = req.query;
    const incluirCanceladas = req.query.incluirCanceladas === 'true';

    res.status(200).json(await agendaService.obtenerVista(vista, fecha, { incluirCanceladas }));
  } catch (error) {
    next(error);
  }
}

/** GET /api/agenda/resumen — datos del panel principal. */
async function obtenerResumen(req, res, next) {
  try {
    res.status(200).json(await agendaService.obtenerResumen());
  } catch (error) {
    next(error);
  }
}

/** GET /api/agenda/configuracion */
async function obtenerConfiguracion(req, res, next) {
  try {
    res.status(200).json(await configuracionService.obtenerTodas());
  } catch (error) {
    next(error);
  }
}

/** PATCH /api/agenda/configuracion — solo administrador. */
async function actualizarConfiguracion(req, res, next) {
  try {
    const configuracion = await configuracionService.establecerVarias(req.body, req.usuario.id);

    // La hora del envío se aplica en caliente: no hace falta reiniciar nada.
    if (configuracionService.CLAVES.HORA_RECORDATORIOS in req.body) {
      await recordatoriosJob.reprogramar();
    }

    res.status(200).json(configuracion);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  obtenerVista,
  obtenerResumen,
  obtenerConfiguracion,
  actualizarConfiguracion,
};
